import React, { useState, useEffect } from 'react';
import CountUp from './countUp'; 

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
  const [distance, setDistance] = useState('16093'); // 10 miles in meters
  const [cuisine, setCuisine] = useState('American');
  const [price, setPrice] = useState('1'); // Price level 1

  // Restaurant list state
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardAnimation, setCardAnimation] = useState('');

  // Saved list state
  const [myList, setMyList] = useState<any[]>([]);
  const [viewingList, setViewingList] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // AI Recommendations state 
  const [aiRecommendations, setAiRecommendations] = useState<any[]>([]);

  // --- Fetch list on mount for Dashboard Display ---
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/myRestaurants', {
        method: 'POST',
        body: JSON.stringify({ userId: userId }),
        headers: { 'Content-Type': 'application/json' }
      });
      let res = JSON.parse(await response.text());
      if (res.results) {
        // Reverse so newest is first (index 0)
        setMyList(res.results.reverse());
      }
    } catch (e) {
      console.error("Error loading dashboard data", e);
    }
  };

const fetchAiRecommendations = async () => {
  // We fetch a list of recommended restaurants based on the user's past ratings.
  
  if (!("geolocation" in navigator)) {
    console.error("Geolocation not supported");
    setAiRecommendations([]);
    return;
  }

  try {
    // Get the user's current location first
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });

    const { latitude, longitude } = position.coords;

    const response = await fetch('http://localhost:5001/api/saved-based-recommendation', {
      method: 'POST',
      body: JSON.stringify({ 
        userId: userId,
        latitude: latitude,    // ✅ Now included
        longitude: longitude   // ✅ Now included
      }),
      headers: { 'Content-Type': 'application/json' }
    });
    
    let res = await response.json();
    
    if (res.recommended && Array.isArray(res.recommended)) {
      // Sort by nbScore descending to show the most likely matches first
      const sortedRecommendations = res.recommended.sort((a: any, b: any) => b.nbScore - a.nbScore);
      setAiRecommendations(sortedRecommendations);
    } else {
      setAiRecommendations([]);
    }
  } catch (e) {
    console.error("Error fetching AI recommendations:", e);
    setAiRecommendations([]);
  }
};

  const handleFindMatch = () => {
    // Fetch recommendations on button click
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          try {
            const body = {
              latitude,
              longitude,
              distance: distance,
              cuisine: cuisine,
              price: price
            };

            const response = await fetch('http://localhost:5001/api/recommendations', {
              method: 'POST',
              body: JSON.stringify(body),
              headers: { 'Content-Type': 'application/json' }
            });

            let res = JSON.parse(await response.text());
            
            // Even if results are empty, we proceed to show the card view (which will show 'No Results')
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
            // --- TEMPORARILY SAVE IMAGE TO LOCAL STORAGE ---
            if (currentRestaurant.photos && currentRestaurant.photos.length > 0) {
              const photoUrl = `http://localhost:5001/api/photo?ref=${currentRestaurant.photos[0].photo_reference}`;
              localStorage.setItem('last_match_id', currentRestaurant.place_id);
              localStorage.setItem('last_match_img', photoUrl);
            }
            // ---------------------------------------------------------

            setShowMatchAnimation(true);
            loadDashboardData(); // Refresh the dashboard list
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
    await loadDashboardData();
    await fetchAiRecommendations(); 
    setViewingList(true);
    setCurrentPage(1);
  };

  if (viewingList) {
    const handleDeleteRestaurant = async (placeId: string, name: string) => {
      if (!window.confirm(`Are you sure you want to delete "${name}"?`)) {
        return;
      }

      try {
        const response = await fetch('http://localhost:5001/api/deleteRestaurant', {
          method: 'POST',
          body: JSON.stringify({ userId: userId, placeId: placeId }),
          headers: { 'Content-Type': 'application/json' }
        });
        let res = JSON.parse(await response.text());
        
        if (res.error) {
          setMessage(`Error: ${res.error}`);
        } else {
          const updatedList = myList.filter(item => item.PlaceId !== placeId);
          setMyList(updatedList);
          setMessage(`"${name}" deleted successfully`);
          
          const totalPages = Math.ceil(updatedList.length / itemsPerPage);
          if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(totalPages);
          }
        }
      } catch (e: any) {
        setMessage(e.toString());
      }
    };
    

    const handleRateRestaurant = async (placeId: string, rating: number) => {
      try {
        const response = await fetch('http://localhost:5001/api/rateRestaurant', {
          method: 'POST',
          body: JSON.stringify({ userId: userId, placeId: placeId, rating: rating }),
          headers: { 'Content-Type': 'application/json' }
        });
        let res = JSON.parse(await response.text());
        
        if (res.error) {
          setMessage(`Error: ${res.error}`);
        } else {
          setMyList(myList.map(item => 
            item.PlaceId === placeId ? { ...item, UserRating: rating } : item
          ));
          setMessage(`Rating updated to ${rating} star${rating !== 1 ? 's' : ''}`);
        }
      } catch (e: any) {
        setMessage(e.toString());
      }
    };

    const totalPages = Math.ceil(myList.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = myList.slice(startIndex, endIndex);

    const StarRating = ({ placeId, currentRating }: { placeId: string, currentRating: number }) => {
      const [hoveredStar, setHoveredStar] = useState(0);
      return (
        <div className="flex gap-1 items-center">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => handleRateRestaurant(placeId, star)}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              className="text-2xl transition-transform hover:scale-125 cursor-pointer focus:outline-none bg-transparent border-0 p-0"
              title={`Rate ${star} star${star !== 1 ? 's' : ''}`}
            >
              <span className={star <= (hoveredStar || currentRating) ? 'text-yellow-400' : 'text-gray-300'}>
                ★
              </span>
            </button>
          ))}
        </div>
      );
    };

    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-8">
        {/* Logo */}
        <div className="absolute top-6 left-6 z-30">
          <div className="flex items-center gap-3 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg py-3 px-4 pl-4 pr-1">
            <img 
              src="/images/speeddininglogo.png" 
              alt="Speed Dining Logo" 
              className="h-[120px] w-[120px] object-contain ml-2"
            />
          </div>
        </div>

        {/* Layout Container - Widened to 7xl to fit side-by-side */}
        <div className="max-w-7xl mx-auto pt-24 lg:pt-32 grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* --- NEW LEFT COLUMN: AI RECOMMENDATIONS SHELL --- */}
          <div className="lg:col-span-1">
            <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-xl border-2 border-indigo-100 sticky top-32">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-gray-800 font-bold text-xl">AI Insights</h3>
              </div>
              
              <p className="text-gray-600 font-medium mb-6 leading-relaxed">
                Based on your ratings, we think you'd like:
              </p>
              
              {/* Recommendation Content */}
              <div className="space-y-4">
                {aiRecommendations.length > 0 ? (
                  aiRecommendations.map((item, index) => (
                    <div key={item.place_id || index} className="bg-gray-50 rounded-xl p-4 border border-gray-100 shadow-md transition-shadow hover:shadow-lg">
                      <div className="flex gap-3 items-start">
                        {/* Dynamic Icon based on price_level */}
                        <div className="h-10 w-10 bg-pink-100 rounded-lg flex items-center justify-center text-xl shadow-inner">
                          {item.price_level === 3 ? '💲💲💲' : item.price_level === 2 ? '💲💲' : '💲'}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-800 leading-tight">
                            {item.name}
                          </h4>
                          <p className="text-xs text-gray-500 mt-1">
                            {item.vicinity}
                          </p>
                          <div className="flex items-center gap-1 mt-2">
                            <span className="text-yellow-500 text-sm">★</span>
                            <span className="text-xs font-semibold text-gray-700">
                              {item.rating || 'N/A'}
                            </span>
                            <span className="text-xs text-gray-400 ml-2">
                              {/* Display the first type/cuisine */}
                              {item.types ? item.types[0] : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : myList.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    <p className="text-sm font-medium">Save some matches first!</p>
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <p className="text-sm font-medium">Not enough data to generate strong recommendations yet.</p>
                  </div>
                )}
              </div>
              
              <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-400 italic">
                  Recommendations are powered by your saved ratings.
                </p>
              </div>
            </div>
          </div>
          {/* --- RIGHT COLUMN: EXISTING LIST VIEW --- */}
          <div className="lg:col-span-2">
            <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">My Saved Restaurants</h2>
                <button 
                  onClick={() => {
                    setViewingList(false);
                    setMessage('');
                  }}
                  className="bg-gradient-to-r from-pink-500 to-red-500 text-white font-bold py-2 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
                >
                  Back to Dashboard
                </button>
              </div>

              {message && (
                <div className="mb-4 bg-green-50 border-l-4 border-green-500 p-4 rounded-xl animate-fade-in">
                  <p className="text-green-700 font-medium">{message}</p>
                </div>
              )}

              <div className="space-y-4">
                {currentItems.map(item => (
                  <div 
                    key={item.PlaceId} 
                    className="bg-gradient-to-r from-white to-gray-50 rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 border border-gray-200"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">{item.Name}</h3>
                        <p className="text-gray-600 mb-1">📍 {item.Vicinity}</p>
                        {item.Rating && (
                          <p className="text-gray-700 mb-3">
                            ⭐ Google Rating: <span className="font-semibold">{item.Rating}</span>
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteRestaurant(item.PlaceId, item.Name)}
                        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
                      >
                        <span>Delete</span>
                      </button>
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-600 font-semibold mb-2">Your Rating:</p>
                      <StarRating 
                        placeId={item.PlaceId} 
                        currentRating={item.UserRating || 0} 
                      />
                    </div>
                  </div>
                ))}

                {myList.length === 0 && (
                  <div className="text-center py-16">
                    <p className="text-gray-600 text-xl">
                      You haven't saved any restaurants yet.
                    </p>
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-8 pt-6 border-t border-gray-200">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all"
                  >
                    Previous
                  </button>
                  
                  <div className="flex gap-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-10 h-10 rounded-lg font-semibold transition-all ${
                          currentPage === pageNum
                            ? 'bg-gradient-to-r from-pink-500 to-red-500 text-white shadow-lg'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Card logic
  const currentRestaurant = recommendations.length > 0 ? recommendations[currentIndex] : null;
  const isLastCard = currentIndex === recommendations.length - 1 && recommendations.length > 0;
  // New condition to catch empty results
  const noResults = recommendations.length === 0; 
  
  // Logic to find most recent match for dashboard
  const mostRecentMatch = myList.length > 0 ? myList[0] : null;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-pink-500 via-red-500 to-orange-500 p-8">
      {/* Logo and Title Header */}
      <div className="absolute top-6 left-6 z-30">
        <div className="flex items-center gap-3 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg py-3 px-4 pl-4 pr-1">
            <img src="/images/speeddininglogo.png" alt="Speed Dining Logo" className="h-[120px] w-[120px] object-contain ml-2"/>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-24 lg:pt-32">
        
        {/* DASHBOARD VIEW */}
        {showSearch && (
          <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT COLUMN: STATS & HISTORY */}
            <div className="lg:col-span-1 space-y-6">
              {/* Matches Count Card */}
              <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-xl border-2 border-pink-100">
                <h3 className="text-gray-500 font-semibold uppercase tracking-wider text-sm mb-2">Matches Made</h3>
                <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-red-600">
                  <CountUp from={0} to={myList.length} separator="," direction="up" duration={1} className="count-up-text"/>
                </div>
                <p className="text-gray-400 text-sm mt-2">Restaurants saved to your list</p>
              </div>

              {/* Most Recent Match Card */}
              <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-6 shadow-xl h-fit">
                <h3 className="text-gray-800 font-bold text-xl mb-4 flex items-center gap-2">
                  Your Most Recent Match
                </h3>
                {mostRecentMatch ? (
                  (() => {
                    const storedId = localStorage.getItem('last_match_id');
                    const storedImg = localStorage.getItem('last_match_img');
                    const hasCachedImage = storedId === mostRecentMatch.PlaceId && storedImg;
                    return (
                      <div className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-200 shadow-inner">
                        {hasCachedImage ? (
                          <img src={storedImg || ''} alt={mostRecentMatch.Name} className="h-40 w-full object-cover"/>
                        ) : (
                          <div className="h-40 bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white flex-col gap-2">
                            <span className="text-xs opacity-75">Image not saved</span>
                          </div>
                        )}
                        <div className="p-4">
                          <h4 className="font-bold text-gray-800 text-lg leading-tight mb-1">{mostRecentMatch.Name}</h4>
                          <p className="text-sm text-gray-500 mb-2 truncate">📍 {mostRecentMatch.Vicinity}</p>
                          <div className="flex items-center gap-1 text-sm">
                            <span className="text-yellow-500">★</span>
                            <span className="font-medium">{mostRecentMatch.Rating || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-2xl border-dashed border-2 border-gray-200">
                    <p className="text-gray-500 text-sm">No matches yet.</p>
                    <p className="text-gray-400 text-xs">Start searching!</p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: SEARCH CONTROLS */}
            <div className="lg:col-span-2">
              <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-8 shadow-2xl h-full flex flex-col justify-between">
                <div>
                  <h2 className="text-4xl font-extrabold text-gray-800 mb-2">Find Your Next Meal</h2>
                  <p className="text-gray-500 mb-8 text-lg">Customize your preferences and let us handle the rest.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <label className="block text-gray-700 font-bold mb-2 text-sm uppercase">Distance</label>
                      <select value={distance} onChange={(e) => setDistance(e.target.value)} className="w-full bg-white px-4 py-3 rounded-xl border border-gray-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition-all font-medium">
                        <option value="8047">5 miles</option>
                        <option value="16093">10 miles</option>
                        <option value="32187">20 miles</option>
                        <option value="80467">50 miles</option>
                      </select>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                      <label className="block text-gray-700 font-bold mb-2 text-sm uppercase">Cuisine</label>
                      <select value={cuisine} onChange={(e) => setCuisine(e.target.value)} className="w-full bg-white px-4 py-3 rounded-xl border border-gray-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition-all font-medium">
                        <option value="Fast food">Fast Food</option>
                        <option value="Dessert">Dessert</option>
                        <option value="American">American</option>
                        <option value="Italian">Italian</option>
                        <option value="Indian">Indian</option>
                      </select>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 md:col-span-2">
                      <label className="block text-gray-700 font-bold mb-2 text-sm uppercase">Price Range</label>
                      <select value={price} onChange={(e) => setPrice(e.target.value)} className="w-full bg-white px-4 py-3 rounded-xl border border-gray-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition-all font-medium">
                        <option value="1">💲 Budget Friendly</option>
                        <option value="2">💲💲 Moderate</option>
                        <option value="3">💲💲💲 Upscale</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="mt-8 pt-8 border-t border-gray-200 space-y-4">
                  <button onClick={handleFindMatch} className="w-full group relative bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white font-bold py-6 rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-3">
                    <span className="text-5xl group-hover:animate-pulse">❤️</span>
                    <span className="text-3xl">Start Matching</span>
                  </button>
                  <button onClick={fetchMyList} className="w-full bg-white text-gray-700 font-bold py-4 rounded-xl border-2 border-gray-200 hover:border-pink-500 hover:text-pink-600 transition-all duration-200">
                    View Full Saved List
                  </button>
                </div>
                {message && (
                  <div className="mt-4 bg-red-50 text-red-600 p-3 rounded-lg text-center text-sm font-medium">{message}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Match Animation Overlay */}
        {showMatchAnimation && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 animate-fade-in">
            <div className="bg-white rounded-3xl p-12 text-center shadow-2xl animate-bounce-in">
              <div className="text-8xl mb-4">💚</div>
              <h2 className="text-4xl font-bold text-pink-600 mb-2">It's a Match!</h2>
              <p className="text-xl text-gray-600">Added to your list!</p>
            </div>
          </div>
        )}

        {/* Card Swiping Interface (Centered) */}
        {showCards && (
          <div className="flex items-center justify-center min-h-[600px]">
            {/* CASE 1: Normal Card */}
            {currentRestaurant && !isLastCard ? (
              <div 
                className={`w-full max-w-md transition-all duration-300 ${
                  cardAnimation === 'left' ? 'translate-x-[-150%] opacity-0' :
                  cardAnimation === 'right' ? 'translate-x-[150%] opacity-0' :
                  'translate-x-0 opacity-100'
                }`}
              >
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                  {currentRestaurant.photos && currentRestaurant.photos.length > 0 ? (
                    <img src={`http://localhost:5001/api/photo?ref=${currentRestaurant.photos[0].photo_reference}`} alt={currentRestaurant.name} className="h-64 w-full object-cover"/>
                  ) : (
                    <div className="h-64 bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center">
                      <span className="text-9xl">🍽️</span>
                    </div>
                  )}
                  <div className="p-8">
                    <h3 className="text-3xl font-bold text-gray-800 mb-2">{currentRestaurant.name}</h3>
                    {currentRestaurant.opening_hours && (
                      <div className="mb-4">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${
                          currentRestaurant.opening_hours.open_now ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          <span className="text-lg">{currentRestaurant.opening_hours.open_now ? '🟢' : '🔴'}</span>
                          {currentRestaurant.opening_hours.open_now ? 'Open Now' : 'Currently Closed'}
                        </span>
                      </div>
                    )}
                    <p className="text-gray-700 mb-4">📍 {currentRestaurant.vicinity}</p>
                    {currentRestaurant.opening_hours && currentRestaurant.opening_hours.weekday_text && (
                      <div className="mb-4 bg-gray-50 rounded-lg p-4">
                        <p className="font-semibold text-gray-700 mb-2">Hours:</p>
                        <div className="text-sm text-gray-600 space-y-1">
                          {currentRestaurant.opening_hours.weekday_text.map((day: string, index: number) => (
                            <p key={index}>{day}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-6">
                      <span className="text-2xl">⭐</span>
                      <span className="text-xl font-semibold text-gray-800">{currentRestaurant.rating}</span>
                      <span className="text-gray-600">({currentRestaurant.user_ratings_total} reviews)</span>
                    </div>
                    <div className="flex justify-center gap-8">
                      <button onClick={() => handleSwipe('left')} className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg transform hover:scale-110 transition-all duration-200 flex items-center justify-center">
                        <span className="text-4xl">✕</span>
                      </button>
                      <button onClick={() => handleSwipe('right')} className="w-20 h-20 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg transform hover:scale-110 transition-all duration-200 flex items-center justify-center">
                        <span className="text-4xl">✓</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (isLastCard || noResults) ? (
              /* CASE 2: End of Results / No Results */
              <div className="w-full max-w-md">
                <div className="bg-white rounded-3xl shadow-2xl p-12 text-center">
                  <div className="text-8xl mb-6">🍽️</div>
                  <h3 className="text-3xl font-bold text-gray-800 mb-4">
                    {noResults ? "No Matches Found" : "End of Search!"}
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
              /* CASE 3: Loading State (Only appears transiently) */
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