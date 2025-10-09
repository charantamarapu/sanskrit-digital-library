import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useEffect } from 'react'; // Add this
import axios from 'axios';
import './AdminLogin.css';
import config from '../config';

function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Add this useEffect to check if already logged in
  useEffect(() => {
    const adminId = localStorage.getItem('adminId');
    if (adminId) {
      navigate('/admin/dashboard');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const response = await axios.post(`${config.API_URL}/api/admin/login`, {
                username,
                password
            });

            if (response.data) {
                localStorage.setItem('adminId', response.data.adminId);
                navigate('/admin/dashboard');
            }
        } catch (error) {
            setError(error.response?.data?.error || 'Login failed. Please try again.');
        }
    };

    return (
        <div className="admin-login">
            <div className="login-container">
                <h2>Admin Login</h2>
                {error && <div className="error-message">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter username"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            required
                        />
                    </div>
                    <button type="submit" className="btn-login">Login</button>
                </form>
                <div className="login-footer">
                    <Link to="/">← Back to Home</Link>
                </div>
            </div>
        </div>
    );
}

export default AdminLogin;
