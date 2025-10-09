import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import GlobalSearch from './GlobalSearch';
import './GranthaList.css';
import config from '../config';

function GranthaList() {
    const [granthas, setGranthas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        fetchGranthas();
    }, [currentPage]);

    useEffect(() => {
        const adminId = localStorage.getItem('adminId');
        setIsAdmin(!!adminId);
    }, []);

    const fetchGranthas = async () => {
        try {
            const response = await axios.get(`${config.API_URL}/api/granthas?page=${currentPage}&limit=9`);
            setGranthas(response.data.granthas);
            setTotalPages(response.data.totalPages);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch granthas:', error);
            setLoading(false);
        }
    };

    const renderPagination = () => {
        const pages = [];
        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);

        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(
                <button
                    key={i}
                    className={`page-number ${currentPage === i ? 'active' : ''}`}
                    onClick={() => setCurrentPage(i)}
                >
                    {i}
                </button>
            );
        }

        return pages;
    };

    if (loading) {
        return <div className="loading">Loading granthas...</div>;
    }

    return (
        <div className="grantha-list">
            <header className="list-header">
                <div className="header-inner">
                    {isAdmin ? (
                        <Link to="/admin/dashboard" className="btn-admin-dashboard">
                            🏠 Admin Dashboard
                        </Link>
                    ) : (
                        <Link to="/" className="btn-home">← Home</Link>
                    )}
                    <div className="header-title">
                        <h1>Sanskrit Granthas</h1>
                        <p className="subtitle">Explore our collection of ancient texts</p>
                    </div>
                    <div className="header-spacer"></div>
                </div>
            </header>

            <div className="search-container">
                <GlobalSearch />
            </div>

            {granthas.length === 0 ? (
                <div className="no-granthas">No granthas available</div>
            ) : (
                <>
                    <div className="grantha-grid">
                        {granthas.map(grantha => (
                            <div key={grantha._id} className="grantha-card">
                                <h3>{grantha.title}</h3>
                                {grantha.author && <p className="author">by {grantha.author}</p>}
                                {grantha.description && <p className="description">{grantha.description}</p>}
                                <Link to={`/grantha/${grantha._id}`} className="btn-view">
                                    View Grantha →
                                </Link>
                            </div>
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className="pagination">
                            <button
                                className="page-btn"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                            >
                                ← Previous
                            </button>
                            <div className="page-numbers">
                                {renderPagination()}
                            </div>
                            <button
                                className="page-btn"
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                            >
                                Next →
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default GranthaList;
