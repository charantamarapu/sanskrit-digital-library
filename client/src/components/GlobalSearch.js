import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './GlobalSearch.css';
import config from '../config';

function GlobalSearch({ isAdmin = false }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

    const searchRef = useRef(null);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (query.trim().length >= 2) {
                performSearch();
            } else {
                setResults([]);
                setShowResults(false);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [query]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                const dropdown = document.getElementById('search-dropdown-portal');
                if (dropdown && !dropdown.contains(event.target)) {
                    setShowResults(false);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const updatePosition = () => {
            if (showResults && inputRef.current) {
                const rect = inputRef.current.getBoundingClientRect();
                setDropdownPosition({
                    top: rect.bottom + window.scrollY + 12,
                    left: rect.left + window.scrollX,
                    width: rect.width
                });
            }
        };

        if (showResults) {
            updatePosition();
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);

            return () => {
                window.removeEventListener('scroll', updatePosition, true);
                window.removeEventListener('resize', updatePosition);
            };
        }
    }, [showResults]);

    const performSearch = async () => {
        setLoading(true);
        try {
            const response = await axios.get(
                `${config.API_URL}/api/search/advanced?q=${encodeURIComponent(query)}`
            );

            setResults(response.data.results || []);
            setShowResults(true);
            setSelectedIndex(-1);
            setLoading(false);
        } catch (error) {
            console.error('Search failed:', error);
            setLoading(false);
        }
    };

    const handleResultClick = (result) => {
        setShowResults(false);
        const searchQuery = query;
        setQuery('');

        navigate(`/grantha/${result.granthaId}`, {
            state: {
                scrollToType: result.type,
                scrollToId: result.type === 'verse' ? result.verseId : result.commentaryId,
                verseId: result.verseId,
                commentaryId: result.commentaryId,
                highlight: searchQuery,
                occurrenceIndex: result.occurrenceIndex || 0
            }
        });
    };

    const handleKeyDown = (e) => {
        if (!showResults || results.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            handleResultClick(results[selectedIndex]);
        } else if (e.key === 'Escape') {
            setShowResults(false);
        }
    };

    // EXACT PHRASE MATCHING - Updated function
    const highlightText = (text, searchQuery) => {
        if (!text || !searchQuery) return text;

        // Exact phrase matching - escape special regex characters
        const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');

        const parts = text.split(regex);

        return parts.map((part, index) => {
            // Check if this part matches the search query (case-insensitive)
            if (part.toLowerCase() === searchQuery.toLowerCase()) {
                return <mark key={index} className="highlight">{part}</mark>;
            }
            return part;
        });
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'grantha': return '📚';
            case 'verse': return '📝';
            case 'commentary': return '💬';
            default: return '•';
        }
    };

    const getTypeLabel = (type) => {
        switch (type) {
            case 'grantha': return 'Grantha';
            case 'verse': return 'Verse (Moolam)';
            case 'commentary': return 'Commentary';
            default: return '';
        }
    };

    const renderDropdown = () => {
        if (!showResults) return null;

        const dropdownContent = (
            <div
                id="search-dropdown-portal"
                className="search-results-dropdown-portal"
                style={{
                    position: 'absolute',
                    top: `${dropdownPosition.top}px`,
                    left: `${dropdownPosition.left}px`,
                    width: `${dropdownPosition.width}px`,
                    zIndex: 10000
                }}
            >
                {results.length > 0 ? (
                    <>
                        <div className="results-header">
                            <span className="results-count">
                                Found <strong>{results.length}</strong> result{results.length !== 1 ? 's' : ''}
                            </span>
                            <span className="results-hint">↑↓ Navigate • ↵ Select • ESC Close</span>
                        </div>
                        <div className="results-list">
                            {results.map((result, index) => (
                                <div
                                    key={result.id}
                                    className={`result-item ${selectedIndex === index ? 'selected' : ''}`}
                                    onClick={() => handleResultClick(result)}
                                >
                                    <div className="result-header">
                                        <div className="result-type">
                                            <span className="type-icon">{getTypeIcon(result.type)}</span>
                                            <span className="type-label">{getTypeLabel(result.type)}</span>
                                        </div>
                                        {result.type !== 'grantha' && (
                                            <span className="verse-badge">
                                                {result.chapterNumber}.{result.verseNumber}
                                            </span>
                                        )}
                                    </div>

                                    <div className="result-title">
                                        {highlightText(result.title, query)}
                                    </div>

                                    {result.subtitle && (
                                        <div className="result-subtitle">
                                            {highlightText(result.subtitle, query)}
                                        </div>
                                    )}

                                    {result.content && (
                                        <div className="result-content">
                                            {highlightText(
                                                result.content.length > 200
                                                    ? result.content.substring(0, 200) + '...'
                                                    : result.content,
                                                query
                                            )}
                                        </div>
                                    )}

                                    <div className="result-action">
                                        View {result.type} →
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="no-results">
                        <span className="no-results-icon">🔍</span>
                        <p>
                            No results found for <strong>"{query}"</strong>
                        </p>
                        <p className="no-results-hint">
                            Try different keywords or check spelling
                        </p>
                    </div>
                )}
            </div>
        );

        return createPortal(dropdownContent, document.body);
    };

    return (
        <div className="global-search" ref={searchRef}>
            <div className="search-input-wrapper">
                <span className="search-icon-left">🔍</span>
                <input
                    ref={inputRef}
                    type="text"
                    className="global-search-input"
                    placeholder="Search granthas"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                {loading && <div className="loading-spinner"></div>}
                {!loading && query && (
                    <button
                        className="clear-button"
                        onClick={() => {
                            setQuery('');
                            setResults([]);
                            setShowResults(false);
                        }}
                    >
                        ×
                    </button>
                )}
            </div>
            {renderDropdown()}
        </div>
    );
}

export default GlobalSearch;
