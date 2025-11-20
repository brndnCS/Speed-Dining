import { useState } from 'react';
import GridMotion from './GridMotion';

function SpeedDiningLogin() {
  const [message, setMessage] = useState('');
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  async function doLogin(event: any): Promise<void> {
    event.preventDefault();
    setIsLoading(true);
    var obj = { login: loginName, password: loginPassword };
    var js = JSON.stringify(obj);
    
    try {
      const response = await fetch('http://localhost:5001/api/login',
        { method: 'POST', body: js, headers: { 'Content-Type': 'application/json' } });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      var res = await response.json();
      
      if (res.id <= 0) {
        setMessage('User/Password combination incorrect');
      } else {
        var user = { firstName: res.firstName, lastName: res.lastName, id: res.id }
        localStorage.setItem('user_data', JSON.stringify(user));
        setMessage('');
        window.location.href = '/loading';
      }
    } catch (error: any) {
      setMessage('Connection error. Please try again.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSetLoginName(e: any): void {
    setLoginName(e.target.value);
  }

  function handleSetPassword(e: any): void {
    setPassword(e.target.value);
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Animated GridMotion Background */}
      <div className="absolute inset-0 z-0">
        <GridMotion items={backgroundItems} gradientColor="rgba(236, 72, 153, 0.3)" />
      </div>

      {/* Gradient overlay matching original colors */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-500/40 via-red-500/40 to-orange-500/40 z-10"></div>

      {/* Login Content */}
      <div className="relative z-20 min-h-screen flex items-center justify-center p-4">
        {/* Login Card */}
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
              <h1 className="text-4xl font-bold text-white mb-2">Speed Dining</h1>
              <p className="text-pink-100">Swipe right on your next meal</p>
            </div>
            {/* Form */}
            <div className="p-8">
              <div className="space-y-6">
                {/* Username Input */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Email
                  </label>
                  <input
                    type="text"
                    value={loginName}
                    onChange={handleSetLoginName}
                    placeholder="Enter your email"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:outline-none transition-colors"
                    onKeyPress={(e: any) => e.key === 'Enter' && doLogin(e)}
                  />
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={handleSetPassword}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:outline-none transition-colors"
                    onKeyPress={(e: any) => e.key === 'Enter' && doLogin(e)}
                  />
                </div>

                {/* Error Message */}
                {message && (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                    <p className="text-red-700 text-sm">{message}</p>
                  </div>
                )}

                {/* Login Button */}
                <button
                  type="button"
                  onClick={doLogin}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-pink-500 to-red-500 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Logging in...
                    </span>
                  ) : (
                    "Let's Dine!"
                  )}
                </button>
              </div>

              {/* Additional Links */}
              <div className="mt-6 text-center space-y-3">
                <button className="block w-full text-red-700 hover:text-pink-600 font-bold text-sm transition-colors">
                  Forgot password?
                </button>
                <div className="text-gray-600 text-sm">
                  Don't have an account?{' '}
                  <button
                    onClick={() => window.location.href = '/signup'} 
                    className="text-red-700 hover:text-pink-600 font-bold transition-colors"
                  >
                    Sign up
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer tagline */}
          <p className="text-center text-white mt-6 text-sm font-medium drop-shadow-lg">
            Discover restaurants as fast as you swipe ❤️
          </p>
        </div>
      </div>
    </div>
  );
}

export default SpeedDiningLogin;
