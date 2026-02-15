import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function Layout({ children, title, breadcrumbs }) {
    return (
        <div className="app-layout">
            <Sidebar />
            <div className="app-main">
                <Navbar title={title} breadcrumbs={breadcrumbs} />
                <main className="app-content">{children}</main>
            </div>
        </div>
    );
}
