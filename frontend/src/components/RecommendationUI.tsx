// src/components/RecommendationUI.tsx

import React, { useState, useEffect } from 'react';

function RecommendationUI() {
    // Get user data from login
    let _ud: any = localStorage.getItem('user_data');
    let ud = JSON.parse(_ud);
    let userId: string = ud.id;

    const [message, setMessage] = useState('');
    
    // Restaurant list state
    const [recommendations, setRecommendations] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    // Saved list state
    const [myList, setMyList] = useState<any[]>([]);
    const [viewingList, setViewingList] = useState(false);

    // Fetch recommendations on component load
    useEffect(() => {
        // 1. Get user's location
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    
                    // 2. Call your new backend endpoint
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
                        } else {
                            setMessage('Could not fetch recommendations.');
                        }
                    } catch (e: any) {
                        setMessage(e.toString());
                    }
                },
                (error) => {
                    // Handle location error (e.g., user denied permission)
                    setMessage('Unable to retrieve your location. Please enable location services.');
                    console.error("Geolocation error:", error);
                }
            );
        } else {
            setMessage('Geolocation is not supported by your browser.');
        }
    }, []); // Empty dependency array means this runs once on load

    // --- Button Handlers ---

    const handleNo = () => {
        // Just move to the next restaurant
        if(currentIndex < recommendations.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            setMessage("You've seen all recommendations!");
        }
    };

    const handleYes = async () => {
        const currentRestaurant = recommendations[currentIndex];
        
        // Call the save endpoint
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
                setMessage(`${currentRestaurant.name} saved!`);
                // Move to the next restaurant
                handleNo();
            }
        } catch (e: any) {
            setMessage(e.toString());
        }
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
                setViewingList(true); // Show the list view
            } else {
                setMessage(res.error || 'Could not fetch list.');
            }
        } catch (e: any) {
            setMessage(e.toString());
        }
    };

    // --- Render Logic ---

    // Show "My List" view
    if (viewingList) {
        return (
            <div>
                <h2>My Saved Restaurants</h2>
                <button onClick={() => setViewingList(false)}>Back to Recommendations</button>
                <ul>
                    {myList.map(item => (
                        <li key={item.PlaceId}>
                            <strong>{item.Name}</strong> ({item.Vicinity}) - Your Rating: {item.UserRating}
                        </li>
                    ))}
                </ul>
                {myList.length === 0 && <p>You haven't saved any restaurants yet.</p>}
            </div>
        );
    }

    // Show Recommendation "Tinder-style" view
    const currentRestaurant = recommendations.length > 0 ? recommendations[currentIndex] : null;

    return (
        <div id="recommendationUIDiv">
            <button onClick={fetchMyList}>View My Saved List</button>
            <hr />
            
            <span id="apiMessage">{message}</span>

            {currentRestaurant ? (
                <div id="recommendationCard">
                    <h2>{currentRestaurant.name}</h2>
                    <p>{currentRestaurant.vicinity}</p>
                    <p>Rating: {currentRestaurant.rating} / 5 ({currentRestaurant.user_ratings_total} reviews)</p>
                    
                    <button type="button" onClick={handleYes} style={{backgroundColor: 'green', marginRight: '10px'}}>YES</button>
                    <button type="button" onClick={handleNo} style={{backgroundColor: 'red'}}>NO</button>
                </div>
            ) : (
                <p>{message || 'Loading recommendations...'}</p>
            )}
        </div>
    );
}

export default RecommendationUI;