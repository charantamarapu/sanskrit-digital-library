import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams, Link, useLocation } from 'react-router-dom';
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from 'docx';
import { saveAs } from 'file-saver';
import config from '../config';
import './GranthaView.css';

function AdvancedPageSearch({
    verses,
    commentariesByVerse,
    onHighlight,
    setExpandedChapters,
    setExpandedVerses
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const performSearch = (searchText) => {
        setQuery(searchText);

        if (searchText.length < 2) {
            setResults([]);
            setShowDropdown(false);
            onHighlight('');
            return;
        }

        const matches = [];
        const lowerQuery = searchText.toLowerCase();

        // Search in verses
        verses.forEach(verse => {
            const verseText = verse.verseText || '';
            if (verseText.toLowerCase().includes(lowerQuery)) {
                matches.push({
                    type: 'verse',
                    chapterNumber: verse.chapterNumber,
                    verseNumber: verse.verseNumber,
                    text: verseText,
                    verseId: verse._id,
                    id: `verse-${verse._id}` // Use actual MongoDB ID
                });
            }

            // Search in commentaries
            const commentaries = commentariesByVerse[verse._id] || [];
            commentaries.forEach(commentary => {
                const commentaryText = commentary.commentaryText || '';
                if (commentaryText.toLowerCase().includes(lowerQuery)) {
                    matches.push({
                        type: 'commentary',
                        chapterNumber: verse.chapterNumber,
                        verseNumber: verse.verseNumber,
                        commentaryName: commentary.commentaryName,
                        text: commentaryText,
                        verseId: verse._id,
                        id: `commentary-${commentary._id}` // Use actual MongoDB ID
                    });
                }
            });
        });

        setResults(matches);
        setShowDropdown(true);
        onHighlight(searchText);
    };

    const scrollToMatch = (result) => {
        const chapterNumber = result.chapterNumber;
        const verseId = result.verseId;

        // First, expand the chapter and verse
        setExpandedChapters(prev => new Set([...prev, chapterNumber]));
        setExpandedVerses(prev => new Set([...prev, verseId]));

        // Wait for DOM to update, then scroll
        setTimeout(() => {
            const element = document.getElementById(result.id);

            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                const verseElement = document.getElementById(`verse-${verseId}`);
                if (verseElement) {
                    verseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }, 300); // Wait for expansion animation

        setShowDropdown(false);
    };

    const getSnippet = (text, query) => {
        // Remove HTML tags for snippet
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text;
        const plainText = tempDiv.textContent || tempDiv.innerText || '';

        const index = plainText.toLowerCase().indexOf(query.toLowerCase());
        if (index === -1) return plainText.substring(0, 100);

        const start = Math.max(0, index - 40);
        const end = Math.min(plainText.length, index + query.length + 40);
        return '...' + plainText.substring(start, end) + '...';
    };

    return (
        <div className="advanced-page-search" ref={searchRef}>
            <div className="search-input-wrapper">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => performSearch(e.target.value)}
                    onFocus={() => query.length >= 2 && setShowDropdown(true)}
                    placeholder="🔍 Search in this page..."
                    className="advanced-search-input"
                />
                {query && (
                    <button
                        onClick={() => {
                            setQuery('');
                            setResults([]);
                            setShowDropdown(false);
                            onHighlight('');
                        }}
                        className="clear-search-btn"
                    >
                        ✕
                    </button>
                )}
            </div>

            {showDropdown && results.length > 0 && (
                <div className="search-results-dropdown">
                    <div className="search-results-header">
                        Found {results.length} {results.length === 1 ? 'match' : 'matches'}
                    </div>
                    <div className="search-results-list">
                        {results.map((result, index) => (
                            <div
                                key={index}
                                className="search-result-item"
                                onClick={() => scrollToMatch(result)}
                            >
                                <div className="result-location">
                                    {result.type === 'verse' ? (
                                        <span className="result-badge verse-badge">
                                            Chapter {result.chapterNumber}, Verse {result.verseNumber}
                                        </span>
                                    ) : (
                                        <span className="result-badge commentary-badge">
                                            {result.commentaryName} - Ch.{result.chapterNumber}, V.{result.verseNumber}
                                        </span>
                                    )}
                                </div>
                                <div className="result-snippet">
                                    {getSnippet(result.text, query)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function GranthaView({ theme, setTheme }) {
    const { id } = useParams();
    const location = useLocation();
    const [grantha, setGrantha] = useState(null);
    const [verses, setVerses] = useState([]);
    const [commentariesByVerse, setCommentariesByVerse] = useState({});
    const [selectedCommentaryNames, setSelectedCommentaryNames] = useState([]);
    const [availableCommentaries, setAvailableCommentaries] = useState([]);
    const [fontFamily, setFontFamily] = useState('Noto Sans Devanagari');
    const [loading, setLoading] = useState(true);
    const [highlightText, setHighlightText] = useState('');

    const [expandedChapters, setExpandedChapters] = useState(new Set());
    const [expandedVerses, setExpandedVerses] = useState(new Set());

    const contentRef = useRef(null);
    const [isAdmin, setIsAdmin] = useState(false);

    // Helper function to strip inline font styles but preserve highlights
    const stripInlineFontStyles = (html) => {
        if (!html) return '';
        const div = document.createElement('div');
        div.innerHTML = html;

        // Remove font-size and font-family from all elements EXCEPT mark tags
        const allElements = div.querySelectorAll('*:not(mark)');
        allElements.forEach(el => {
            el.style.fontSize = '';
            el.style.fontFamily = '';
        });

        return div.innerHTML;
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    useEffect(() => {
        if (!loading && verses.length > 0 && location.state) {
            const { scrollToType, scrollToId, verseId, commentaryId, highlight, occurrenceIndex = 0 } = location.state;

            if (highlight) {
                setHighlightText(highlight);
            }

            if (verseId) {
                const verse = verses.find(v => v._id === verseId);
                if (verse) {
                    setExpandedChapters(prev => new Set(prev).add(verse.chapterNumber));
                    setExpandedVerses(prev => new Set(prev).add(verseId));

                    setTimeout(() => {
                        let elementId;

                        // First try to find the specific highlighted text occurrence
                        if (scrollToType === 'verse' && verseId) {
                            elementId = `highlight-verse-${verseId}-${occurrenceIndex}`;
                        } else if (scrollToType === 'commentary' && commentaryId) {
                            elementId = `highlight-commentary-${commentaryId}-${occurrenceIndex}`;
                        }

                        // Fallback to container if specific highlight not found
                        let element = document.getElementById(elementId);

                        if (!element) {
                            if (scrollToType === 'verse' && verseId) {
                                elementId = `verse-${verseId}`;
                            } else if (scrollToType === 'commentary' && commentaryId) {
                                elementId = `commentary-${commentaryId}`;
                            } else if (scrollToId) {
                                elementId = `verse-${scrollToId}`;
                            }
                            element = document.getElementById(elementId);
                        }

                        if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            element.classList.add('flash-highlight');
                            setTimeout(() => {
                                element.classList.remove('flash-highlight');
                            }, 3000);
                        }
                    }, 800);
                }
            }
        }
    }, [loading, verses, location.state, commentariesByVerse]);  // Removed hasScrolled dependency

    useEffect(() => {
        const adminId = localStorage.getItem('adminId');
        setIsAdmin(!!adminId);
    }, []);

    /// Force font size and family on all text elements - runs whenever DOM changes
    useEffect(() => {
        const applyFontStyles = () => {
            const verseElements = document.querySelectorAll('.verse-text, .verse-text *, .commentary-text, .commentary-text *');
            verseElements.forEach(el => {
                el.style.setProperty('font-family', fontFamily, 'important');
            });
        };

        // Apply styles initially
        applyFontStyles();

        // Watch for DOM changes and reapply styles
        const observer = new MutationObserver(() => {
            applyFontStyles();
        });

        // Observe the content container for changes
        const contentContainer = document.querySelector('.content-viewer');
        if (contentContainer) {
            observer.observe(contentContainer, {
                childList: true,
                subtree: true,
                attributes: false
            });
        }

        // Cleanup
        return () => {
            observer.disconnect();
        };
    }, [fontFamily]);

    const fetchData = async () => {
        try {
            const granthaRes = await axios.get(`${config.API_URL}/api/granthas/${id}`);
            setGrantha(granthaRes.data);

            const versesRes = await axios.get(`${config.API_URL}/api/verses/grantha/${id}`);
            setVerses(versesRes.data);

            const commentariesRes = await axios.get(`${config.API_URL}/api/commentaries/grantha/${id}`);

            const commentariesMap = {};
            const commentaryNamesSet = new Set();

            commentariesRes.data.forEach(commentary => {
                const verseId = commentary.verseId._id || commentary.verseId;
                if (!commentariesMap[verseId]) {
                    commentariesMap[verseId] = [];
                }
                commentariesMap[verseId].push(commentary);
                commentaryNamesSet.add(commentary.commentaryName);
            });

            setCommentariesByVerse(commentariesMap);
            const commentaryNamesArray = Array.from(commentaryNamesSet);
            setAvailableCommentaries(commentaryNamesArray);
            setSelectedCommentaryNames(commentaryNamesArray); // Select all by default
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            setLoading(false);
        }
    };

    const toggleCommentary = (commentaryName) => {
        setSelectedCommentaryNames(prev =>
            prev.includes(commentaryName)
                ? prev.filter(name => name !== commentaryName)
                : [...prev, commentaryName]
        );
    };

    const toggleChapter = (chapterNumber) => {
        setExpandedChapters(prev => {
            const newSet = new Set(prev);
            if (newSet.has(chapterNumber)) {
                newSet.delete(chapterNumber);
            } else {
                newSet.add(chapterNumber);
            }

            // Apply font styles after expansion
            setTimeout(() => {
                const verseElements = document.querySelectorAll('.verse-text, .verse-text *, .commentary-text, .commentary-text *');
                verseElements.forEach(el => {
                    el.style.setProperty('font-family', fontFamily, 'important');
                });
            }, 50);

            return newSet;
        });
    };

    const toggleVerse = (verseId) => {
        setExpandedVerses(prev => {
            const newSet = new Set(prev);
            if (newSet.has(verseId)) {
                newSet.delete(verseId);
            } else {
                newSet.add(verseId);
            }

            // Apply font styles after state update
            setTimeout(() => {
                const verseElements = document.querySelectorAll('.verse-text, .verse-text *, .commentary-text, .commentary-text *');
                verseElements.forEach(el => {
                    el.style.setProperty('font-family', fontFamily, 'important');
                });
            }, 50); // Small delay to let DOM update

            return newSet;
        });
    };

    const expandAll = () => {
        const allChapters = new Set(verses.map(v => v.chapterNumber));
        const allVerses = new Set(verses.map(v => v._id));
        setExpandedChapters(allChapters);
        setExpandedVerses(allVerses);

        // Apply font styles after expansion
        setTimeout(() => {
            const verseElements = document.querySelectorAll('.verse-text, .verse-text *, .commentary-text, .commentary-text *');
            verseElements.forEach(el => {
                el.style.setProperty('font-family', fontFamily, 'important');
            });
        }, 50);
    };

    const collapseAll = () => {
        setExpandedChapters(new Set());
        setExpandedVerses(new Set());
    };

    const highlightSearchText = (text, verseId, commentaryId = null) => {
        if (!highlightText || !text) return text;

        // Strip HTML tags first to search in plain text
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text;
        const plainText = tempDiv.textContent || tempDiv.innerText || '';

        // If no match in plain text, return original
        if (!plainText.toLowerCase().includes(highlightText.toLowerCase())) {
            return text;
        }

        const escapedQuery = highlightText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');

        let occurrenceIndex = 0;
        const highlighted = text.replace(regex, (match) => {
            const uniqueId = commentaryId
                ? `highlight-commentary-${commentaryId}-${occurrenceIndex}`
                : `highlight-verse-${verseId}-${occurrenceIndex}`;
            occurrenceIndex++;
            return `<mark id="${uniqueId}" class="highlight-match">${match}</mark>`;
        });

        return highlighted;
    };

    const htmlToTextRuns = (html) => {
        if (!html) return [{ runs: [new TextRun({ text: '' })], alignment: null }];

        // Don't convert <p> to pilcrow, keep them as separate paragraphs
        const div = document.createElement('div');
        div.innerHTML = html;
        const paragraphs = [];
        let currentAlignment = null;

        const processParagraph = (node, inheritedStyle = {}) => {
            const textRuns = [];

            const processNode = (node, style) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent;
                    if (text) {
                        const processedText = text.replace(/\u00A0/g, ' ').replace(/\u2003/g, '\t');
                        textRuns.push(new TextRun({
                            text: processedText,
                            bold: style.bold || false,
                            italics: style.italics || false,
                            underline: style.underline ? { type: 'single' } : undefined,
                            size: style.size || 24,
                            font: style.font || undefined
                        }));
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const tagName = node.tagName.toLowerCase();
                    const newStyle = { ...style };

                    // Check for bold
                    if (tagName === 'strong' || tagName === 'b' ||
                        (node.style && (node.style.fontWeight === 'bold' || node.style.fontWeight === '700'))) {
                        newStyle.bold = true;
                    }

                    // Check for italic
                    if (tagName === 'em' || tagName === 'i' ||
                        (node.style && node.style.fontStyle === 'italic')) {
                        newStyle.italics = true;
                    }

                    // Check for underline
                    if (tagName === 'u' ||
                        (node.style && node.style.textDecoration === 'underline')) {
                        newStyle.underline = true;
                    }

                    // Check for font-size
                    if (node.style && node.style.fontSize) {
                        const fontSize = parseInt(node.style.fontSize);
                        if (!isNaN(fontSize)) {
                            newStyle.size = fontSize * 2;
                        }
                    }

                    // Check for font-family
                    if (node.style && node.style.fontFamily) {
                        newStyle.font = node.style.fontFamily.replace(/['\"]/g, '').split(',')[0].trim();
                    }

                    // Check for alignment
                    if (node.style && node.style.textAlign) {
                        currentAlignment = node.style.textAlign;
                    }

                    // Handle line breaks
                    if (tagName === 'br') {
                        textRuns.push(new TextRun({ text: '', break: 1 }));
                        return;
                    }

                    // Process children for other tags
                    Array.from(node.childNodes).forEach(child => processNode(child, newStyle));
                }
            };

            processNode(node, inheritedStyle);
            return textRuns;
        };

        // Process top-level nodes - KEEP THEM SEPARATE
        Array.from(div.childNodes).forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() === 'p') {
                const runs = processParagraph(node);
                if (runs.length > 0) {
                    paragraphs.push({ runs, alignment: currentAlignment });
                } else {
                    // Empty paragraph
                    paragraphs.push({ runs: [new TextRun({ text: '' })], alignment: currentAlignment });
                }
            } else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                paragraphs.push({ runs: [new TextRun({ text: node.textContent })], alignment: currentAlignment });
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const runs = processParagraph(node);
                if (runs.length > 0) {
                    paragraphs.push({ runs, alignment: currentAlignment });
                }
            }
        });

        // Return ARRAY of paragraph objects, not flattened runs
        return paragraphs.length > 0 ? paragraphs : [{ runs: [new TextRun({ text: '' })], alignment: null }];
    };

    const generateWord = async () => {
        if (!verses || verses.length === 0) {
            alert('❌ No content to export');
            return;
        }

        try {
            const children = [];

            // Title
            children.push(
                new Paragraph({
                    text: grantha.title,
                    heading: HeadingLevel.HEADING_1,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 }
                })
            );

            // Author
            if (grantha.author) {
                children.push(
                    new Paragraph({
                        text: `by ${grantha.author}`,
                        alignment: AlignmentType.CENTER,
                        italics: true,
                        spacing: { after: 400 }
                    })
                );
            }

            // Separator line
            children.push(
                new Paragraph({
                    text: '_______________________________________________________________',
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 }
                })
            );

            // Process each verse
            verses.forEach((verse, vIndex) => {
                // Verse header
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `${grantha.chapterLabel || 'अध्यायः'} ${verse.chapterNumber}, ${grantha.verseLabel || 'श्लोकः'} ${verse.verseNumber}`,
                                bold: true,
                                size: 28
                            })
                        ],
                        spacing: { before: 300, after: 200 }
                    })
                );

                // For verses
                const verseParagraphs = htmlToTextRuns(verse.verseText);
                verseParagraphs.forEach(para => {
                    children.push(new Paragraph({
                        children: para.runs,
                        spacing: { before: 100, after: 100 },
                        indent: { left: 400 },
                        alignment: para.alignment === 'center' ? AlignmentType.CENTER :
                            para.alignment === 'right' ? AlignmentType.RIGHT :
                                AlignmentType.LEFT
                    }));
                });

                // Commentaries
                const verseCommentaries = commentariesByVerse[verse._id] || [];
                verseCommentaries
                    .filter(c => selectedCommentaryNames.includes(c.commentaryName))
                    .sort((a, b) => (a.level || 0) - (b.level || 0))
                    .forEach(commentary => {
                        const level = commentary.level || 0;

                        // Commentary name
                        children.push(
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: `${commentary.commentaryName}${level > 0 ? ` (Level ${level})` : ''}`,
                                        bold: true,
                                        size: 24
                                    })
                                ],
                                spacing: { before: 200, after: 100 },
                                indent: { left: level * 400 + 400 }
                            })
                        );

                        // Commentary author
                        if (commentary.commentator) {
                            children.push(
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: `by ${commentary.commentator}`,
                                            italics: true,
                                            size: 20
                                        })
                                    ],
                                    spacing: { after: 100 },
                                    indent: { left: level * 400 + 400 }
                                })
                            );
                        }

                        // For commentaries
                        const commentaryParagraphs = htmlToTextRuns(commentary.commentaryText);
                        commentaryParagraphs.forEach(para => {
                            children.push(new Paragraph({
                                children: para.runs,
                                spacing: { before: 100, after: 100 },
                                indent: { left: 800 },
                                alignment: para.alignment === 'center' ? AlignmentType.CENTER :
                                    para.alignment === 'right' ? AlignmentType.RIGHT :
                                        AlignmentType.LEFT
                            }));
                        });
                    });

                // Separator between verses
                if (vIndex < verses.length - 1) {
                    children.push(
                        new Paragraph({
                            text: '_______________________________________________________________',
                            alignment: AlignmentType.CENTER,
                            spacing: { before: 300, after: 300 }
                        })
                    );
                }
            });

            // Create document
            const doc = new Document({
                sections: [{
                    properties: {
                        page: {
                            margin: {
                                top: 1440,
                                right: 1440,
                                bottom: 1440,
                                left: 1440
                            }
                        }
                    },
                    children: children
                }]
            });

            // Generate and download
            const blob = await Packer.toBlob(doc);
            const filename = grantha.title.replace(/[^a-zA-Z0-9\u0900-\u097F\s]/g, '_').replace(/\s+/g, '_') + '.docx';
            saveAs(blob, filename);

            alert('✅ Word document generated successfully!');

        } catch (error) {
            console.error('Word generation error:', error);
            alert('❌ Failed to generate Word document: ' + error.message);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner-large"></div>
                <p>Loading grantha...</p>
            </div>
        );
    }

    if (!grantha) {
        return (
            <div className="error-container">
                <span className="error-icon">⚠️</span>
                <h2>Grantha not found</h2>
                <Link to="/granthas" className="btn-primary">← Back to List</Link>
            </div>
        );
    }

    const chapterGroups = verses.reduce((acc, verse) => {
        if (!acc[verse.chapterNumber]) {
            acc[verse.chapterNumber] = [];
        }
        acc[verse.chapterNumber].push(verse);
        return acc;
    }, {});

    const formatForDisplay = (html) => {
        if (!html) return '';
        // Keep <p> tags for proper paragraph breaks
        // Just ensure they're properly formatted
        return html
            .replace(/<p>/gi, '<p>')
            .replace(/<\/p>/gi, '</p>');
    };

    return (
        <div className="grantha-view">
            <header className="view-header">
                <div className="header-content">
                    {isAdmin ? (
                        <>
                            <Link to="/admin/dashboard" className="btn-back">
                                <span>🏠</span>
                                <span>Admin Dashboard</span>
                            </Link>
                            <Link to="/granthas" className="btn-back">
                                <span>📚</span>
                                <span>Back to List</span>
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link to="/" className="btn-back">
                                <span>🏠</span>
                                <span>Home</span>
                            </Link>
                            <Link to="/granthas" className="btn-back">
                                <span>📚</span>
                                <span>Back to List</span>
                            </Link>
                        </>
                    )}
                    <div className="header-search">
                        <AdvancedPageSearch
                            verses={verses}
                            commentariesByVerse={commentariesByVerse}
                            onHighlight={setHighlightText}
                            setExpandedChapters={setExpandedChapters}
                            setExpandedVerses={setExpandedVerses}
                        />
                    </div>
                </div>

                <div className="header-title">
                    <h1>{grantha.title}</h1>
                    {grantha.author && <p className="author">by {grantha.author}</p>}
                </div>
            </header>

            <div className="controls-panel">
                <div className="control-group">
                    <label>
                        <span className="control-icon">✒️</span>
                        <span>Font Family</span>
                    </label>
                    <select
                        value={fontFamily}
                        onChange={(e) => setFontFamily(e.target.value)}
                        className="control-select"
                    >
                        <option value="Noto Sans Devanagari">Noto Sans Devanagari</option>
                        <option value="Tiro Devanagari Sanskrit">Tiro Devanagari Sanskrit</option>
                        <option value="Siddhanta">Siddhanta</option>
                    </select>
                </div>

                <div className="control-group">
                    <label>
                        <span className="control-icon">🎨</span>
                        <span>Theme</span>
                    </label>
                    <select
                        value={theme}
                        onChange={(e) => setTheme(e.target.value)}
                        className="control-select"
                    >
                        <option value="light">☀️ Light Mode</option>
                        <option value="sepia">📜 Sepia Mode</option>
                        <option value="dark">🌙 Dark Mode</option>
                    </select>
                </div>
            </div>

            {availableCommentaries.length > 0 && (
                <div className="commentary-selector">
                    <h3>
                        <span className="section-icon">💬</span>
                        <span>Select Commentaries</span>
                    </h3>
                    <div className="commentary-options">
                        {availableCommentaries.map(name => (
                            <label key={name} className="commentary-checkbox">
                                <input
                                    type="checkbox"
                                    checked={selectedCommentaryNames.includes(name)}
                                    onChange={() => toggleCommentary(name)}
                                />
                                <span className="checkbox-label">{name}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            <div className="expand-collapse-controls">
                <button onClick={expandAll} className="btn-expand-collapse">
                    ⬇️ Expand All
                </button>
                <button onClick={collapseAll} className="btn-expand-collapse">
                    ⬆️ Collapse All
                </button>
            </div>

            <div className="content-display" ref={contentRef}>
                {Object.entries(chapterGroups).sort(([a], [b]) => Number(a) - Number(b)).map(([chapterNumber, chapterVerses]) => (
                    <div key={chapterNumber} className="chapter-section">
                        <div
                            className={`chapter-header ${expandedChapters.has(Number(chapterNumber)) ? 'expanded' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleChapter(Number(chapterNumber));
                            }}
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                            <span className="chapter-icon">
                                {expandedChapters.has(Number(chapterNumber)) ? '📖' : '📕'}
                            </span>
                            <span className="chapter-title">
                                {grantha.chapterLabel || 'अध्यायः'} {chapterNumber}
                            </span>
                            <span className="chapter-count">
                                ({chapterVerses.length} verses)
                            </span>
                            <span className="expand-indicator">
                                {expandedChapters.has(Number(chapterNumber)) ? '▼' : '▶'}
                            </span>
                        </div>

                        {expandedChapters.has(Number(chapterNumber)) && (
                            <div className="chapter-content">
                                {chapterVerses.map((verse) => (
                                    <div key={verse._id} className="verse-item" id={`verse-${verse._id}`}>
                                        <div
                                            className={`verse-header-collapsible ${expandedVerses.has(verse._id) ? 'expanded' : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleVerse(verse._id);
                                            }}
                                            style={{ cursor: 'pointer', userSelect: 'none' }}
                                        >
                                            <span className="verse-number-badge">
                                                {grantha.verseLabel || 'श्लोकः'} {verse.verseNumber}
                                            </span>
                                            <span className="expand-indicator-small">
                                                {expandedVerses.has(verse._id) ? '▼' : '▶'}
                                            </span>
                                        </div>

                                        {expandedVerses.has(verse._id) && (
                                            <div className="verse-content">
                                                <div
                                                    className="verse-text"
                                                    style={{ fontFamily: fontFamily }}
                                                    dangerouslySetInnerHTML={{ __html: highlightSearchText(stripInlineFontStyles(formatForDisplay(verse.verseText), verse._id)) }}
                                                />

                                                {commentariesByVerse[verse._id] && (() => {
                                                    const allCommentaries = commentariesByVerse[verse._id]
                                                        .filter(c => selectedCommentaryNames.includes(c.commentaryName));

                                                    // Separate parent commentaries (no parent or level 0)
                                                    const parentCommentaries = allCommentaries.filter(c =>
                                                        !c.parentCommentaryId || c.level === 0
                                                    );

                                                    // Recursive function to render commentary with children
                                                    const renderCommentaryWithChildren = (commentary, depth = 0) => {
                                                        const children = allCommentaries.filter(c =>
                                                            c.parentCommentaryId &&
                                                            String(c.parentCommentaryId._id || c.parentCommentaryId) === String(commentary._id)
                                                        );

                                                        return (
                                                            <React.Fragment key={commentary._id}>
                                                                <div
                                                                    className="commentary-block"
                                                                    id={`commentary-${commentary._id}`}
                                                                    style={{
                                                                        marginLeft: depth > 0 ? `${depth * 30}px` : '0',
                                                                        borderLeft: depth > 0 ? '3px solid var(--primary)' : 'none',
                                                                        paddingLeft: depth > 0 ? '15px' : '0',
                                                                        marginTop: depth > 0 ? '10px' : '20px'
                                                                    }}
                                                                >
                                                                    <div className="commentary-header">
                                                                        <span className="commentary-icon">💬</span>
                                                                        <div className="commentary-meta">
                                                                            <strong className="commentary-name">
                                                                                {commentary.commentaryName}
                                                                                {commentary.level > 0 && (
                                                                                    <span className="level-badge" style={{ marginLeft: '8px', fontSize: '12px', padding: '2px 8px', background: 'var(--primary)', color: 'white', borderRadius: '10px' }}>
                                                                                        Level {commentary.level}
                                                                                    </span>
                                                                                )}
                                                                            </strong>
                                                                            {commentary.commentator && (
                                                                                <span className="commentator">by {commentary.commentator}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div
                                                                        className="commentary-text"
                                                                        style={{ fontFamily: fontFamily }}
                                                                        dangerouslySetInnerHTML={{ __html: highlightSearchText(stripInlineFontStyles(formatForDisplay(commentary.commentaryText), verse._id, commentary._id)) }}
                                                                    />
                                                                </div>

                                                                {/* Render sub-commentaries recursively */}
                                                                {children.length > 0 && children.map(child =>
                                                                    renderCommentaryWithChildren(child, depth + 1)
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    };

                                                    // Render only parent commentaries
                                                    return parentCommentaries
                                                        .sort((a, b) => (a.level || 0) - (b.level || 0))
                                                        .map(commentary => renderCommentaryWithChildren(commentary, 0));
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="action-buttons">
                <button
                    className="btn-download"
                    onClick={generateWord}
                >
                    <span className="btn-icon">📄</span>
                    <span>Download Word</span>
                </button>
                <Link to={`/suggest/${id}`} className="btn-suggest">
                    <span className="btn-icon">✏️</span>
                    <span>Suggest Edit</span>
                </Link>
            </div>
        </div>
    );
}

export default GranthaView;
