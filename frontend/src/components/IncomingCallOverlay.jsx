import { useState, useEffect, useCallback, useRef } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';

/**
 * IncomingCallOverlay — GLOBAL component, ALWAYS mounted in ProjectView.
 * This ensures incoming call notifications are received even when
 * the VideoCall panel is NOT open (the root cause of the notification bug).
 *
 * When a call is accepted, it passes the call data up so the parent
 * can open the VideoCall component with the Agora channel info.
 */
export default function IncomingCallOverlay({ socket, onAcceptCall, onRejectCall }) {
    const [incomingCall, setIncomingCall] = useState(null);
    const timeoutRef = useRef(null);

    useEffect(() => {
        if (!socket) return;

        const handleIncomingCall = (data) => {
            console.log('📞 Incoming call received:', data);
            setIncomingCall(data);

            // Auto-reject after 30 seconds
            timeoutRef.current = setTimeout(() => {
                handleReject(data);
            }, 30000);
        };

        const handleCallCancelled = () => {
            console.log('📞 Call cancelled by caller');
            cleanup();
        };

        socket.on('incoming_call', handleIncomingCall);
        socket.on('call_cancelled', handleCallCancelled);

        return () => {
            socket.off('incoming_call', handleIncomingCall);
            socket.off('call_cancelled', handleCallCancelled);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [socket]);

    const cleanup = () => {
        setIncomingCall(null);
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const handleAccept = () => {
        if (!incomingCall) return;
        const callData = { ...incomingCall };
        // Tell the caller we accepted
        if (socket) {
            socket.emit('answer_call', {
                callerSocketId: incomingCall.callerSocketId,
                channelName: incomingCall.channelName
            });
        }
        cleanup();
        onAcceptCall(callData);
    };

    const handleReject = (data) => {
        const call = data || incomingCall;
        if (!call) return;
        if (socket) {
            socket.emit('reject_call', { callerSocketId: call.callerSocketId });
        }
        cleanup();
        if (onRejectCall) onRejectCall();
    };

    if (!incomingCall) return null;

    return (
        <div className="incoming-call-global-overlay">
            <div className="incoming-call-card">
                {/* Animated rings */}
                <div className="incoming-call-rings">
                    <div className="incoming-ring incoming-ring-1" />
                    <div className="incoming-ring incoming-ring-2" />
                    <div className="incoming-ring incoming-ring-3" />
                </div>

                {/* Avatar */}
                <div className="incoming-call-avatar">
                    <div className="incoming-call-avatar-inner">
                        {incomingCall.callerName?.[0]?.toUpperCase() || '?'}
                    </div>
                </div>

                {/* Info */}
                <div className="incoming-call-info">
                    <div className="incoming-call-label">
                        <Video size={14} />
                        <span>Incoming Video Call</span>
                    </div>
                    <h3 className="incoming-call-name">{incomingCall.callerName}</h3>
                    <p className="incoming-call-subtitle">wants to video chat with you</p>
                </div>

                {/* Buttons */}
                <div className="incoming-call-actions">
                    <button
                        className="incoming-call-btn incoming-call-btn-reject"
                        onClick={() => handleReject()}
                        title="Decline"
                    >
                        <PhoneOff size={22} />
                        <span>Decline</span>
                    </button>
                    <button
                        className="incoming-call-btn incoming-call-btn-accept"
                        onClick={handleAccept}
                        title="Accept"
                    >
                        <Phone size={22} />
                        <span>Accept</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
