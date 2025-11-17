import React, { useState } from 'react';
import GridMotion from './GridMotion';

function SpeedDiningSignup() {
  const [message, setMessage] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Restaurant images for the animated background
  const backgroundItems = [
    '/images/HamburgerSpeeddining.png',
    '/images/HotdogSpeedDining.png',
    '/images/speeddiningdonut.png',
    '/images/HamburgerSpeeddining.png',
    '/images/HotdogSpeedDining.png',
    '/images/speeddiningdonut.png',
    '/images/HamburgerSpeeddining.png',
    '/images/HotdogSpeedDining.png',
    '/images/speeddiningdonut.png',
    '/images/HamburgerSpeeddining.png',
    '/images/HotdogSpeedDining.png',
    '/images/speeddiningdonut.png',
    '/images/HamburgerSpeeddining.png',
    '/images/HotdogSpeedDining.png',
    '/images/speeddiningdonut.png',
    '/images/HamburgerSpeeddining.png',
    '/images/HotdogSpeedDining.png',
    '/images/speeddiningdonut.png',
    '/images/HamburgerSpeeddining.png',
    '/images/HotdogSpeedDining.png',
    '/images/speeddiningdonut.png',
    '/images/HamburgerSpeeddining.png',
    '/images/HotdogSpeedDining.png',
    '/images/speeddiningdonut.png',
    '/images/HamburgerSpeeddining.png',
    '/images/HotdogSpeedDining.png',
    '/images/speeddiningdonut.png',
    '/images/HamburgerSpeeddining.png',
  ];

  async function doSignup(event: any): Promise<void> {
    event.preventDefault();
    setMessage('');
    
    if (!firstName || !lastName || !signupName || !signupPassword) {
      setMessage('Please fill in all fields');
      return;
    }

    if (signupPassword !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }

    if (signupPassword.length < 6) {
      setMessage('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    var obj = { 
      login: signupName,
      password: signupPassword,
      firstName: firstName,
      lastName: lastName
    };
    var js = JSON.stringify(obj);
    
    try {
      const response = await fetch('http://localhost:5001/api/signup',
        { method: 'POST', body: js, headers: { 'Content-Type': 'application/json' } });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      var res = await response.json();
      
      if (res.id <= 0 || res.error) {
        setMessage(res.error || 'Signup failed');
      } else {
        setIsSuccess(true);
        setMessage('Account created successfully! Check your email for your verification link...');
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      }
    } catch (error: any) {
      setMessage('Connection error. Please try again.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSetFirstName(e: any): void {
    setFirstName(e.target.value);
  }

  function handleSetLastName(e: any): void {
    setLastName(e.target.value);
  }

  function handleSetSignupName(e: any): void {
    setSignupName(e.target.value);
  }

  function handleSetSignupPassword(e: any): void {
    setSignupPassword(e.target.value);
  }

  function handleSetConfirmPassword(e: any): void {
    setConfirmPassword(e.target.value);
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Animated GridMotion Background */}
      <div className="fixed inset-0 z-0">
        <GridMotion items={backgroundItems} gradientColor="rgba(236, 72, 153, 0.3)" />
      </div>

      {/* Gradient overlay matching original colors */}
      <div className="fixed inset-0 bg-gradient-to-br from-pink-500/40 via-red-500/40 to-orange-500/40 z-10"></div>

      {/* Signup Content */}
      <div className="relative z-20 min-h-screen flex items-center justify-center p-4">
        {/* Signup Card */}
        <div className="w-full max-w-lg">
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden transform transition-all duration-300 hover:scale-105">
          {/* Header */}
          <div className="bg-gradient-to-r from-pink-500 to-red-500 p-8 text-center">
            <div className="flex justify-center mb-4">
              <img 
                src="/images/speeddininglogo.png" 
                alt="Speed Dining Logo" 
                className="h-[150px] w-[150px] object-contain ml-5" 
              />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">Join Speed Dining</h1>
            <p className="text-pink-100">Create your account and start swiping!</p>
          </div>
            {/* Form */}
            <div className="p-8">
              <div className="space-y-5">
                {/* First Name Input */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={handleSetFirstName}
                    placeholder="Enter your first name"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:outline-none transition-colors"
                  />
                </div>

                {/* Last Name Input */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={handleSetLastName}
                    placeholder="Enter your last name"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:outline-none transition-colors"
                  />
                </div>

                {/* Username Input */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Email
                  </label>
                  <input
                    type="text"
                    value={signupName}
                    onChange={handleSetSignupName}
                    placeholder="Enter your email"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:outline-none transition-colors"
                  />
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={signupPassword}
                    onChange={handleSetSignupPassword}
                    placeholder="Create a password (min 6 characters)"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:outline-none transition-colors"
                  />
                </div>

                {/* Confirm Password Input */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={handleSetConfirmPassword}
                    placeholder="Confirm your password"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:outline-none transition-colors"
                    onKeyPress={(e: any) => e.key === 'Enter' && doSignup(e)}
                  />
                </div>

                {/* Error/Success Message */}
                {message && (
                  <div className={`border-l-4 p-4 rounded ${
                    isSuccess 
                      ? 'bg-green-50 border-green-500' 
                      : 'bg-red-50 border-red-500'
                  }`}>
                    <p className={`text-sm ${
                      isSuccess ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {message}
                    </p>
                  </div>
                )}

                {/* Signup Button */}
                <button
                  type="button"
                  onClick={doSignup}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-pink-500 to-red-500 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating account...
                    </span>
                  ) : (
                    "Create Account!"
                  )}
                </button>
              </div>

              {/* Additional Links */}
              <div className="mt-6 text-center">
                <div className="text-gray-600 text-sm">
                  Already have an account?{' '}
                  <button 
                    onClick={() => window.location.href = '/'}
                    className="text-pink-500 hover:text-pink-600 font-semibold transition-colors"
                  >
                    Log in
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer tagline */}
          <p className="text-center text-white mt-6 text-sm font-medium drop-shadow-lg">
            Join thousands discovering their next favorite meal ❤️
          </p>
        </div>
      </div>
    </div>
  );
}

export default SpeedDiningSignup;
