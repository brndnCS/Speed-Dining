import React, { useState, useEffect } from 'react';

function RecommendationUI() {
  // Get user data from login
  let _ud: any = localStorage.getItem('user_data');
  let ud = JSON.parse(_ud);
  let userId: string = ud.id;

  const [message, setMessage] = useState('');
  const [showSearch, setShowSearch] = useState(true);
  const [showCards, setShowCards] = useState(false);
  const [showMatchAnimation, setShowMatchAnimation] = useState(false);
  
  // Filter states
  const [distance, setDistance] = useState('10 mi');
  const [cuisine, setCuisine] = useState('American');
  const [price, setPrice] = useState('$');

  // Restaurant list state
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardAnimation, setCardAnimation] = useState('');

  // Saved list state
  const [myList, setMyList] = useState<any[]>([]);
  const [viewingList, setViewingList] = useState(false);

  const handleFindMatch = () => {
    // Fetch recommendations on button click
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          try {
            const response = await fetch('http://localhost:5001/api/recommendations', {
              method: 'POST',
              body: JSON.stringify({ latitude, longitude }),
              headers: { 'Content-Type': 'application/json' }
            });

            let res = JSON.parse(await response.text());
            if (res.results) {
              setRecommendations(res.results);
              setCurrentIndex(0);
              setMessage('');
              setShowSearch(false);
              setShowCards(true);
            } else {
              setMessage('Could not fetch recommendations.');
            }
          } catch (e: any) {
            setMessage(e.toString());
          }
        },
        (error) => {
          setMessage('Unable to retrieve your location. Please enable location services.');
          console.error("Geolocation error:", error);
        }
      );
    } else {
      setMessage('Geolocation is not supported by your browser.');
    }
  };

  const handleSwipe = async (direction: 'left' | 'right') => {
    setCardAnimation(direction);
    
    setTimeout(async () => {
      if (direction === 'right') {
        // Save restaurant to list
        const currentRestaurant = recommendations[currentIndex];
        
        try {
          const response = await fetch('http://localhost:5001/api/saveRestaurant', {
            method: 'POST',
            body: JSON.stringify({ userId: userId, restaurant: currentRestaurant }),
            headers: { 'Content-Type': 'application/json' }
          });

          let res = JSON.parse(await response.text());
          if (res.error) {
            setMessage(`Error: ${res.error}`);
          } else {
            // Show match animation
            setShowMatchAnimation(true);
            setTimeout(() => {
              setShowMatchAnimation(false);
              resetToSearch();
            }, 2000);
          }
        } catch (e: any) {
          setMessage(e.toString());
        }
      } else {
        // Move to next card
        if (currentIndex < recommendations.length - 1) {
          setCurrentIndex(currentIndex + 1);
          setCardAnimation('');
        } else {
          // End of list - show end card
          setCardAnimation('');
        }
      }
    }, 300);
  };

  const resetToSearch = () => {
    setShowCards(false);
    setShowSearch(true);
    setCurrentIndex(0);
    setCardAnimation('');
    setRecommendations([]);
  };

  // --- View My List ---
  const fetchMyList = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/myRestaurants', {
        method: 'POST',
        body: JSON.stringify({ userId: userId }),
        headers: { 'Content-Type': 'application/json' }
      });
      let res = JSON.parse(await response.text());
      if (res.results) {
        setMyList(res.results);
        setViewingList(true);
      } else {
        setMessage(res.error || 'Could not fetch list.');
      }
    } catch (e: any) {
      setMessage(e.toString());
    }
  };

  // Show "My List" view
  if (viewingList) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-8">
        {/* Logo and Title Header - Top Left */}
        <div className="absolute top-6 left-6 z-30">
        <div className="flex items-center gap-3 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg py-3 px-4 pl-4 pr-1">
            <img 
            src="/images/speeddininglogo.png" 
            alt="Speed Dining Logo" 
            className="h-[120px] w-[120px] object-contain ml-2"
            />
        </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-gray-800">My Saved Restaurants</h2>
              <button 
                onClick={() => setViewingList(false)}
                className="bg-gradient-to-r from-pink-500 to-red-500 text-white font-bold py-2 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
              >
                Back to Search
              </button>
            </div>
            <div className="space-y-4">
              {myList.map(item => (
                <div key={item.PlaceId} className="bg-gray-50 rounded-xl p-6 shadow">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{item.Name}</h3>
                  <p className="text-gray-600 mb-2">📍 {item.Vicinity}</p>
                  <p className="text-gray-700">⭐ Your Rating: {item.UserRating}</p>
                </div>
              ))}
              {myList.length === 0 && (
                <p className="text-center text-gray-600 text-lg py-8">
                  You haven't saved any restaurants yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentRestaurant = recommendations.length > 0 ? recommendations[currentIndex] : null;
  const isLastCard = currentIndex === recommendations.length - 1 && recommendations.length > 0;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-8">
    {/* Logo and Title Header - Top Left */}
    <div className="absolute top-6 left-6 z-30">
    <div className="flex items-center gap-3 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg py-3 px-4 pl-4 pr-1">
        <img 
        src="/images/speeddininglogo.png" 
        alt="Speed Dining Logo" 
        className="h-[120px] w-[120px] object-contain ml-2"
        />
    </div>
    </div>
      <div className="max-w-4xl mx-auto">
        
        {/* Search Interface */}
        {showSearch && (
          <div className="animate-fade-in">
            {/* Single Container Box */}
            <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-2xl space-y-6">
              {/* View My List Button */}
              <div className="flex justify-center">
                <button
                  onClick={fetchMyList}
                  className="bg-gradient-to-r from-pink-500 to-red-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
                >
                  📋 View My Saved List
                </button>
              </div>

              <hr className="border-gray-300" />

              {/* Filter Section */}
              <div>
                <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
                  Customize Your Search
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Distance Filter */}
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Distance
                    </label>
                    <select
                      value={distance}
                      onChange={(e) => setDistance(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:outline-none transition-colors bg-white"
                    >
                      <option value="5 mi">5 miles</option>
                      <option value="10 mi">10 miles</option>
                      <option value="20 mi">20 miles</option>
                      <option value="50 mi">50 miles</option>
                    </select>
                  </div>

                  {/* Cuisine Filter */}
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Cuisine
                    </label>
                    <select
                      value={cuisine}
                      onChange={(e) => setCuisine(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:outline-none transition-colors bg-white"
                    >
                      <option value="Fast food">Fast Food</option>
                      <option value="Dessert">Dessert</option>
                      <option value="American">American</option>
                      <option value="Italian">Italian</option>
                      <option value="Indian">Indian</option>
                    </select>
                  </div>

                  {/* Price Filter */}
                  <div>
                    <label className="block text-gray-700 font-semibold mb-2">
                      Price Range
                    </label>
                    <select
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:outline-none transition-colors bg-white"
                    >
                      <option value="$">$ - Budget Friendly</option>
                      <option value="$">$ - Moderate</option>
                      <option value="$$">$$ - Upscale</option>
                    </select>
                  </div>
                </div>
              </div>

              <hr className="border-gray-300" />

              {/* Find Match Button */}
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleFindMatch}
                  className="group relative bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white font-bold py-8 px-12 rounded-full shadow-2xl transform hover:scale-105 transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-6xl group-hover:animate-pulse">❤️</div>
                    <div>
                      <div className="text-2xl mt-2">Find Your Match!</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Error Message */}
            {message && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl mt-4">
                <p className="text-red-700">{message}</p>
              </div>
            )}
          </div>
        )}

        {/* Match Animation */}
        {showMatchAnimation && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 animate-fade-in">
            <div className="bg-white rounded-3xl p-12 text-center shadow-2xl animate-bounce-in">
              <div className="text-8xl mb-4">💚</div>
              <h2 className="text-4xl font-bold text-pink-600 mb-2">It's a Match!</h2>
              <p className="text-xl text-gray-600">Added to your list!</p>
            </div>
          </div>
        )}

        {/* Card Swiping Interface */}
        {showCards && (
          <div className="flex items-center justify-center min-h-[600px]">
            {currentRestaurant && !isLastCard ? (
              <div 
                className={`w-full max-w-md transition-all duration-300 ${
                  cardAnimation === 'left' ? 'translate-x-[-150%] opacity-0' :
                  cardAnimation === 'right' ? 'translate-x-[150%] opacity-0' :
                  'translate-x-0 opacity-100'
                }`}
              >
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                  {/* Restaurant Image Placeholder */}
                  <div className="h-64 bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center">
                    <span className="text-9xl">🍽️</span>
                  </div>

                  {/* Restaurant Info */}
                  <div className="p-8">
                    <h3 className="text-3xl font-bold text-gray-800 mb-2">
                      {currentRestaurant.name}
                    </h3>
                    <p className="text-gray-700 mb-4">
                      📍 {currentRestaurant.vicinity}
                    </p>
                    <div className="flex items-center gap-2 mb-6">
                      <span className="text-2xl">⭐</span>
                      <span className="text-xl font-semibold text-gray-800">
                        {currentRestaurant.rating}
                      </span>
                      <span className="text-gray-600">
                        ({currentRestaurant.user_ratings_total} reviews)
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-center gap-8">
                      <button
                        onClick={() => handleSwipe('left')}
                        className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg transform hover:scale-110 transition-all duration-200 flex items-center justify-center"
                      >
                        <span className="text-4xl">✕</span>
                      </button>
                      <button
                        onClick={() => handleSwipe('right')}
                        className="w-20 h-20 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg transform hover:scale-110 transition-all duration-200 flex items-center justify-center"
                      >
                        <span className="text-4xl">✓</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : isLastCard ? (
              /* End of Results Card */
              <div className="w-full max-w-md">
                <div className="bg-white rounded-3xl shadow-2xl p-12 text-center">
                  <div className="text-8xl mb-6">🍽️</div>
                  <h3 className="text-3xl font-bold text-gray-800 mb-4">
                    End of Search!
                  </h3>
                  <p className="text-xl text-gray-600 mb-8">
                    Search again with different criteria to find more matches!
                  </p>
                  <button
                    onClick={resetToSearch}
                    className="bg-gradient-to-r from-pink-500 to-red-500 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
                  >
                    New Search
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-white text-xl">{message || 'Loading recommendations...'}</p>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce-in {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
        .animate-bounce-in {
          animation: bounce-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}

export default RecommendationUI;