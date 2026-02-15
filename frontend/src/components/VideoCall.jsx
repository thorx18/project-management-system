import { useState, useEffect, useRef, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import {
    Video, VideoOff, Mic, MicOff, Phone, PhoneOff,
    X, Maximize2, Minimize2
} from 'lucide-react';

// ── Agora App ID ──
const AGORA_APP_ID = import.meta.env.VITE_AGORA_APP_ID || '';

// Show all logs during dev for debugging
AgoraRTC.setLogLevel(0);

export default function VideoCall({
    socket,
    user,
    onlineUsers,
    projectId,
    onClose,
    activeCall,
    onCallStateChange
}) {
    const [isCallActive, setIsCallActive] = useState(false);
    const [isCalling, setIsCalling] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [selectedUser, setSelectedUser] = useState(null);
    const [callError, setCallError] = useState('');
    const [hasRemoteUser, setHasRemoteUser] = useState(false);
    const [agoraStatus, setAgoraStatus] = useState('');

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const clientRef = useRef(null);
    const localTracksRef = useRef({ audioTrack: null, videoTrack: null });
    const durationIntervalRef = useRef(null);
    const callerSocketIdRef = useRef(null);
    const channelRef = useRef('');
    const isJoinedRef = useRef(false);

    // ─── Create Agora client once ───
    useEffect(() => {
        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        clientRef.current = client;

        client.on('connection-state-change', (curState, prevState, reason) => {
            console.log('🔗 Agora state:', prevState, '→', curState, reason);
            setAgoraStatus(`Agora: ${curState}`);
        });

        client.on('user-published', async (remoteUser, mediaType) => {
            console.log('🎥 Remote user published:', remoteUser.uid, mediaType);
            setAgoraStatus('Remote user joined!');
            try {
                await client.subscribe(remoteUser, mediaType);
                console.log('🎥 Subscribed to:', remoteUser.uid, mediaType);

                if (mediaType === 'video') {
                    setHasRemoteUser(true);
                    // Wait for DOM to be ready, then play
                    requestAnimationFrame(() => {
                        setTimeout(() => {
                            const container = remoteVideoRef.current;
                            if (container && remoteUser.videoTrack) {
                                console.log('🎥 Playing remote video into container');
                                remoteUser.videoTrack.play(container);
                            }
                        }, 200);
                    });
                }

                if (mediaType === 'audio') {
                    remoteUser.audioTrack?.play();
                    console.log('🔊 Playing remote audio');
                }
            } catch (err) {
                console.error('Error subscribing to remote user:', err);
            }
        });

        client.on('user-unpublished', (remoteUser, mediaType) => {
            console.log('🎥 Remote user unpublished:', remoteUser.uid, mediaType);
            if (mediaType === 'video') {
                setHasRemoteUser(false);
            }
        });

        client.on('user-left', (remoteUser) => {
            console.log('🎥 Remote user left:', remoteUser.uid);
            setHasRemoteUser(false);
            endCallCleanup();
        });

        return () => {
            leaveChannel();
            client.removeAllListeners();
        };
    }, []);

    // ─── Socket listeners ───
    useEffect(() => {
        if (!socket) return;

        const handleCallAnswered = (data) => {
            console.log('📞 Call answered! Channel:', channelRef.current);
            setIsCalling(false);
            setIsCallActive(true);
            startDurationTimer();
            // Small delay to ensure DOM refs are ready after state change
            setTimeout(() => {
                joinChannel(channelRef.current);
            }, 300);
        };

        const handleCallEnded = () => {
            console.log('📞 Remote ended call');
            endCallCleanup();
        };

        const handleCallRejected = (data) => {
            console.log('📞 Call rejected', data?.reason);
            setIsCalling(false);
            setCallError(data?.reason || 'Call was declined');
            setTimeout(() => setCallError(''), 3000);
            leaveChannel();
        };

        socket.on('call_answered', handleCallAnswered);
        socket.on('call_ended', handleCallEnded);
        socket.on('call_rejected', handleCallRejected);

        return () => {
            socket.off('call_answered', handleCallAnswered);
            socket.off('call_ended', handleCallEnded);
            socket.off('call_rejected', handleCallRejected);
        };
    }, [socket]);

    // ─── Handle accepted incoming call (callee side) ───
    useEffect(() => {
        if (activeCall) {
            console.log('📞 Accepting call, channel:', activeCall.channelName);
            setIsCallActive(true);
            setSelectedUser({
                userName: activeCall.callerName,
                userId: activeCall.callerId
            });
            callerSocketIdRef.current = activeCall.callerSocketId;
            channelRef.current = activeCall.channelName;
            startDurationTimer();
            // Delay join to let the video container DOM render first
            setTimeout(() => {
                joinChannel(activeCall.channelName);
            }, 500);
        }
    }, [activeCall]);

    // ─── Join Agora channel ───
    const joinChannel = async (channel) => {
        try {
            if (!AGORA_APP_ID) {
                setCallError('Agora App ID not configured! Add VITE_AGORA_APP_ID to frontend/.env');
                return;
            }

            const client = clientRef.current;
            if (!client || isJoinedRef.current) return;

            const uid = user?.id || Math.floor(Math.random() * 100000);

            // Fetch token from backend (required when App Certificate is enabled)
            console.log('🎫 Fetching Agora token for channel:', channel, 'uid:', uid);
            setAgoraStatus('Fetching token...');
            let token = null;
            try {
                const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
                const tokenRes = await fetch(`${backendUrl}/api/agora/token?channelName=${encodeURIComponent(channel)}&uid=${uid}`);
                const tokenData = await tokenRes.json();
                if (tokenData.token) {
                    token = tokenData.token;
                    console.log('✅ Got Agora token');
                } else {
                    console.warn('⚠️ No token returned, trying without token:', tokenData.error);
                }
            } catch (tokenErr) {
                console.warn('⚠️ Token fetch failed, trying without token:', tokenErr);
            }

            console.log('🔗 Joining Agora channel:', channel, 'as uid:', uid);
            setAgoraStatus('Connecting to Agora...');
            await client.join(AGORA_APP_ID, channel, token, uid);
            isJoinedRef.current = true;
            console.log('✅ Joined Agora channel successfully');
            setAgoraStatus('Connected! Waiting for remote user...');

            // Create local tracks
            let audioTrack, videoTrack;
            try {
                [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
                    {},
                    { encoderConfig: '480p_2', optimizationMode: 'detail' }
                );
                console.log('✅ Created local audio + video tracks');
            } catch (mediaErr) {
                console.error('❌ Media error:', mediaErr);
                // Try audio only
                try {
                    audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
                    console.log('✅ Created audio track only (camera unavailable)');
                    setCallError('Camera unavailable — audio only');
                    setTimeout(() => setCallError(''), 3000);
                } catch (audioErr) {
                    setCallError('Cannot access camera or microphone');
                    return;
                }
            }

            localTracksRef.current = { audioTrack, videoTrack };

            // Play local video into the self-view container
            if (videoTrack && localVideoRef.current) {
                console.log('🎥 Playing local video');
                videoTrack.play(localVideoRef.current);
            }

            // Publish tracks
            const tracksToPublish = [audioTrack, videoTrack].filter(Boolean);
            if (tracksToPublish.length > 0) {
                await client.publish(tracksToPublish);
                console.log('✅ Published', tracksToPublish.length, 'tracks');
            }
        } catch (err) {
            console.error('❌ Error joining channel:', err);
            const msg = err.message || String(err);
            if (msg.includes('INVALID_OPERATION') || msg.includes('dynamic key')) {
                setCallError('Agora: Token required. Disable App Certificate in Agora Console or generate a temp token.');
            } else {
                setCallError('Failed to connect: ' + msg);
            }
            setAgoraStatus('Error: ' + msg);
            setTimeout(() => setCallError(''), 8000);
        }
    };

    // ─── Leave channel ───
    const leaveChannel = async () => {
        const { audioTrack, videoTrack } = localTracksRef.current;
        if (audioTrack) { audioTrack.stop(); audioTrack.close(); }
        if (videoTrack) { videoTrack.stop(); videoTrack.close(); }
        localTracksRef.current = { audioTrack: null, videoTrack: null };

        if (clientRef.current && isJoinedRef.current) {
            try { await clientRef.current.leave(); } catch (e) { }
            isJoinedRef.current = false;
        }
        setHasRemoteUser(false);
    };

    // ─── Start call (caller) ───
    const startCall = async (targetUser) => {
        setSelectedUser(targetUser);
        setIsCalling(true);
        setCallError('');

        const channel = `call_${projectId}_${Date.now()}`;
        channelRef.current = channel;
        callerSocketIdRef.current = targetUser.socketId;

        socket.emit('call_user', {
            projectId,
            targetUserId: targetUser.userId,
            callerName: `${user.first_name} ${user.last_name}`,
            callerId: user.id,
            channelName: channel
        });

        console.log('📞 Calling', targetUser.userName, 'on channel:', channel);
    };

    // ─── End call cleanup ───
    const endCallCleanup = () => {
        leaveChannel();
        setIsCallActive(false);
        setIsCalling(false);
        setSelectedUser(null);
        callerSocketIdRef.current = null;
        channelRef.current = '';
        clearInterval(durationIntervalRef.current);
        setCallDuration(0);
        if (onCallStateChange) onCallStateChange(false);
    };

    const handleEndCall = () => {
        if (socket && callerSocketIdRef.current) {
            socket.emit('end_call', { targetSocketId: callerSocketIdRef.current });
        }
        endCallCleanup();
    };

    const cancelCall = () => {
        if (socket && callerSocketIdRef.current) {
            socket.emit('call_cancelled_by_caller', { targetSocketId: callerSocketIdRef.current });
        }
        setIsCalling(false);
        setSelectedUser(null);
        callerSocketIdRef.current = null;
        channelRef.current = '';
    };

    // ─── Controls ───
    const toggleMute = () => {
        const { audioTrack } = localTracksRef.current;
        if (audioTrack) {
            audioTrack.setEnabled(isMuted); // toggle: if muted, enable; if not, disable
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        const { videoTrack } = localTracksRef.current;
        if (videoTrack) {
            videoTrack.setEnabled(isVideoOff);
            setIsVideoOff(!isVideoOff);
        }
    };

    const startDurationTimer = () => {
        setCallDuration(0);
        if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
    };

    const formatDuration = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const otherUsers = (onlineUsers || []).filter(u => u.userId !== user?.id);

    // ═══ Active call or calling ═══
    if (isCallActive || isCalling) {
        return (
            <div className={`video-container ${isMinimized ? 'video-minimized' : ''}`}>
                <div className="video-header">
                    <div className="video-header-info">
                        <div className="video-status-dot" />
                        <span>{isCalling ? 'Ringing...' : formatDuration(callDuration)}</span>
                        {selectedUser && <span className="video-peer-name">{selectedUser.userName}</span>}
                        {agoraStatus && <span style={{ fontSize: 10, color: '#facc15', marginLeft: 8 }}>{agoraStatus}</span>}
                    </div>
                    <div className="video-header-actions">
                        <button className="video-icon-btn" onClick={() => setIsMinimized(!isMinimized)}>
                            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                        </button>
                    </div>
                </div>

                <div className="video-streams">
                    {/* Remote video container — Agora renders into this */}
                    <div
                        ref={remoteVideoRef}
                        className="agora-video-remote"
                        style={{
                            width: '100%',
                            height: '100%',
                            position: 'relative',
                            overflow: 'hidden',
                            background: '#000'
                        }}
                    >
                        {!hasRemoteUser && !isCalling && (
                            <div style={{
                                position: 'absolute', inset: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--text-muted)', fontSize: 13
                            }}>
                                Waiting for remote video...
                            </div>
                        )}
                    </div>

                    {/* Local self-view — Agora renders into this */}
                    <div
                        ref={localVideoRef}
                        className="agora-video-local"
                        style={{
                            position: 'absolute',
                            bottom: 12, right: 12,
                            width: 140, height: 105,
                            borderRadius: 12,
                            border: '2px solid rgba(255,255,255,0.15)',
                            overflow: 'hidden',
                            zIndex: 5,
                            background: '#111'
                        }}
                    />

                    {isCalling && (
                        <div className="video-calling-overlay">
                            <div className="video-calling-pulse" />
                            <p>Calling {selectedUser?.userName}...</p>
                        </div>
                    )}

                    {callError && (
                        <div className="video-error-overlay">
                            <p>{callError}</p>
                        </div>
                    )}
                </div>

                <div className="video-controls">
                    <button className={`video-ctrl-btn ${isMuted ? 'active' : ''}`} onClick={toggleMute}>
                        {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                    <button className={`video-ctrl-btn ${isVideoOff ? 'active' : ''}`} onClick={toggleVideo}>
                        {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                    </button>
                    <button
                        className="video-ctrl-btn video-ctrl-end"
                        onClick={isCalling ? cancelCall : handleEndCall}
                    >
                        <PhoneOff size={20} />
                    </button>
                </div>
            </div>
        );
    }

    // ═══ User selection panel ═══
    return (
        <div className="video-panel">
            <div className="video-panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Video size={18} style={{ color: 'var(--accent-green)' }} />
                    <h3>Video Call</h3>
                </div>
                <button className="video-panel-close" onClick={onClose}><X size={18} /></button>
            </div>
            <div className="video-panel-body">
                {!AGORA_APP_ID && (
                    <div className="video-config-warning">
                        <p>⚠️ Agora App ID not configured</p>
                        <span>Add <code>VITE_AGORA_APP_ID=your_app_id</code> to <code>frontend/.env</code></span>
                    </div>
                )}
                {callError && (
                    <div className="video-config-warning" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}>
                        <p style={{ color: 'var(--accent-red)' }}>{callError}</p>
                    </div>
                )}
                {otherUsers.length === 0 ? (
                    <div className="video-empty">
                        <Video size={32} style={{ opacity: 0.3 }} />
                        <p>No other members are online</p>
                        <span>Invite team members to start a call</span>
                    </div>
                ) : (
                    <>
                        <p className="video-panel-subtitle">Online members ({otherUsers.length})</p>
                        <div className="video-user-list">
                            {otherUsers.map(u => (
                                <div key={u.userId} className="video-user-item" onClick={() => startCall(u)}>
                                    <div className="video-user-avatar">
                                        {u.userName?.[0]?.toUpperCase() || '?'}
                                        <div className="video-user-online" />
                                    </div>
                                    <span className="video-user-name">{u.userName}</span>
                                    <button className="video-call-btn">
                                        <Video size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
