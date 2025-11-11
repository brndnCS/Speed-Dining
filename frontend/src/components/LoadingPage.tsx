import React, { useState, useEffect } from 'react';
import GridMotion from './GridMotion';

function LoadingPage() {
  const [currentEmoji, setCurrentEmoji] = useState(0);
  const foodEmojis = ['🍔', '🍕', '🌮', '🍣', '🍜', '🍰', '🌭', '🍩'];

  useEffect(() => {
    // Rotate food emojis every 500ms
    const emojiInterval = setInterval(() => {
      setCurrentEmoji((prev) => (prev + 1) % foodEmojis.length);
    }, 500);

    // Redirect to cards page after 5 seconds
    const redirectTimer = setTimeout(() => {
      window.location.href = '/cards';
    }, 5000);

    return () => {
      clearInterval(emojiInterval);
      clearTimeout(redirectTimer);
    };
  }, []);

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

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Animated GridMotion Background */}
      <div className="absolute inset-0 z-0">
        <GridMotion items={backgroundItems} gradientColor="rgba(236, 72, 153, 0.3)" />
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-500/40 via-red-500/40 to-orange-500/40 z-10"></div>

      {/* Loading Content */}
      <div className="relative z-20 min-h-screen flex flex-col items-center justify-center p-4">
        {/* Loading Spinner with Food Emoji */}
        <div className="relative">
          {/* Rotating outer ring */}
          <div className="w-40 h-40 rounded-full border-8 border-pink-200 border-t-pink-500 animate-spin"></div>
          
          {/* Food emoji in center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl animate-pulse">
              {foodEmojis[currentEmoji]}
            </span>
          </div>
        </div>

        {/* Loading text */}
        <div className="mt-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-2 drop-shadow-lg">
            Finding Your Perfect Meal...
          </h2>
          <p className="text-white/90 text-lg drop-shadow-md">
            Get ready to swipe! 🍽️
          </p>
        </div>

        {/* Loading dots animation */}
        <div className="flex gap-2 mt-6">
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
}

export default LoadingPage;