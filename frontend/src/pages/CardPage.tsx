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
            <RecommendationUI />
        </div>
    );
}

export default CardPage;