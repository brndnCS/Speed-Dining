function LoggedInName() {
  function getCurrentUserName() {
    var data;
    data = JSON.parse(localStorage.getItem('user_data') || '');
    return data.firstName + ' ' + data.lastName;
  }
  
  function doLogout(event: any): void {
    event.preventDefault();
    localStorage.removeItem('user_data');
    window.location.href = '/';
  }
  
  return (
    <div className="absolute top-6 right-6 z-30">
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg px-6 py-3 flex items-center gap-4">
        <div className="text-gray-700 font-medium text-center">
          <div>Welcome to Speed Dining,</div>
          <div className="font-bold text-pink-600">{getCurrentUserName()}!</div>
        </div>
        <button 
          type="button" 
          onClick={doLogout}
          className="bg-gradient-to-r from-pink-500 to-red-500 text-white font-bold py-2 px-6 rounded-lg shadow hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
        >
          Log Out
        </button>
      </div>
    </div>
  );
}

export default LoggedInName;