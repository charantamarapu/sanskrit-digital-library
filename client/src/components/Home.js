import React from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

function Home({ theme, setTheme }) {
    return (
        <div className="home">
            {/* Theme Selector */}
            <div className="theme-selector-top">
                <button
                    className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                    onClick={() => setTheme('light')}
                    title="Light Mode"
                >
                    ☀️
                </button>
                <button
                    className={`theme-btn ${theme === 'sepia' ? 'active' : ''}`}
                    onClick={() => setTheme('sepia')}
                    title="Sepia Mode"
                >
                    📜
                </button>
                <button
                    className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                    onClick={() => setTheme('dark')}
                    title="Dark Mode"
                >
                    🌙
                </button>
            </div>

            <header className="home-header">
                <h1>Sanskrit Digital Library</h1>
                <h2>संस्कृत डिजिटल पुस्तकालयः</h2>
                <p>Explore ancient Sanskrit texts with modern technology. Read, search, and contribute to preserving our cultural heritage.</p>
                <div className="home-actions">
                    <Link to="/granthas" className="btn-primary">
                        <span>Browse Granthas</span>
                    </Link>
                    <Link to="/admin/login" className="btn-secondary">
                        <span>Admin Login</span>
                    </Link>
                </div>
            </header>

            <div className="home-content">
                <div className="features">
                    <div className="feature-card">
                        <h3>Digital Library</h3>
                        <p>Access a vast collection of Sanskrit granthas with original texts and multiple commentaries.</p>
                    </div>
                    <div className="feature-card">
                        <h3>Advanced Search</h3>
                        <p>Search across granthas, verses, and commentaries with instant highlighting and navigation.</p>
                    </div>
                    <div className="feature-card">
                        <h3>Customizable Reading</h3>
                        <p>Adjust font size, family, and theme for optimal reading experience.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Home;
