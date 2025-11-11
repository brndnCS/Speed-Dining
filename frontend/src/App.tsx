//import React from 'react';
import { BrowserRouter as Router, Route, Navigate, Routes } from 'react-router-dom';
import './App.css';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import CardPage from './pages/CardPage';
import LoadingPageWrapper from './pages/LoadingPage';

function App() {
    return (
        <Router >
            <Routes>
                <Route path="/" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/loading" element={<LoadingPageWrapper />} />
                <Route path="/cards" element={<CardPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
    );
}
export default App;
