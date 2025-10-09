import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import GranthaList from './components/GranthaList';
import GranthaView from './components/GranthaView';
import SuggestionForm from './components/SuggestionForm';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import GranthaManager from './components/GranthaManager';
import VerseManager from './components/VerseManager';
import CommentaryManager from './components/CommentaryManager';
import './App.css';

function App() {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('theme') || 'light';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    return (
        <Router>
            <div className="App" data-theme={theme}>
                <Routes>
                    <Route path="/" element={<Home theme={theme} setTheme={setTheme} />} />
                    <Route path="/granthas" element={<GranthaList theme={theme} setTheme={setTheme} />} />
                    <Route path="/grantha/:id" element={<GranthaView theme={theme} setTheme={setTheme} />} />
                    <Route path="/suggest/:id" element={<SuggestionForm theme={theme} setTheme={setTheme} />} />
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route path="/admin/dashboard" element={<AdminDashboard />} />
                    <Route path="/admin/granthas" element={<GranthaManager />} />
                    <Route path="/admin/verses/:granthaId" element={<VerseManager />} />
                    <Route path="/admin/commentaries/:verseId" element={<CommentaryManager />} />
                    <Route path="/admin/verses/:granthaId" element={<VerseManager theme={theme} />} />
                    <Route path="/admin/commentaries/:verseId" element={<CommentaryManager theme={theme} />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
