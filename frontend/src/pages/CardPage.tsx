// src/pages/CardPage.tsx
// (This is the entire modified file)


import LoggedInName from '../components/LoggedInName';
// Import your new component
import RecommendationUI from '../components/RecommendationUI';

const CardPage = () =>
{
    return(
        <div>
            <LoggedInName />
            {/* Use your new component here */}
            <RecommendationUI />
        </div>
    );
}

export default CardPage;