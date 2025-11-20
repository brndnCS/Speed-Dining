// Simple Naive Bayes for restaurant recommendation
// Features: rating, types (array), price, distance, name
// Label: userRating (number)

class NaiveBayes {
  constructor() {
    this.featureCounts = {}; // feature -> value -> label -> count
    this.labelCounts = {};   // label -> count
    this.totalCount = 0;
    this.labels = new Set();
  }

  // Helper: convert features to simple key-value pairs
  _flattenFeatures(features) {
    const flat = {};

    // rating -> round to nearest 0.5
    if (features.rating != null) flat.rating = Math.round(features.rating * 2) / 2;

    // price -> 1–4
    if (features.price != null) flat.price = features.price;

    // distance -> bucketize
    if (features.distance != null) {
      if (features.distance < 1000) flat.distance = "<1km";
      else if (features.distance < 2000) flat.distance = "1-2km";
      else if (features.distance < 5000) flat.distance = "2-5km";
      else flat.distance = ">5km";
    }

    // types -> each type becomes a separate feature
    if (features.types && Array.isArray(features.types)) {
      features.types.forEach(t => { flat[`type_${t}`] = true });
    }

    // name -> split into lowercase words
    if (features.name) {
      features.name.toLowerCase().split(/\W+/).forEach(w => {
        if (w) flat[`name_${w}`] = true;
      });
    }

    // --- NEW: OpenNow ---
    if (features.openNow != null) {
      flat[`open_${features.openNow}`] = true;  // e.g., open_true or open_false
    }

    return flat;
  }


  // Train on one restaurant
  train(features) {
    const label = features.userRating;
    if (label == null) return;

    this.totalCount += 1;
    this.labels.add(label);
    this.labelCounts[label] = (this.labelCounts[label] || 0) + 1;

    const flat = this._flattenFeatures(features);

    for (const key in flat) {
      const value = flat[key];
      this.featureCounts[key] = this.featureCounts[key] || {};
      this.featureCounts[key][value] = this.featureCounts[key][value] || {};
      this.featureCounts[key][value][label] = (this.featureCounts[key][value][label] || 0) + 1;
    }
  }

  // Predict a score for new restaurant
  predict(features) {
    const flat = this._flattenFeatures(features);
    const labels = Array.from(this.labels);

    if (labels.length === 0) return 0; // no training

    const scores = {};

    labels.forEach(label => {
      // start with prior probability
      let score = (this.labelCounts[label] || 1) / (this.totalCount || 1);

      // multiply conditional probabilities for each feature
      for (const key in flat) {
        const value = flat[key];

        const valueCounts = this.featureCounts[key]?.[value] || {};
        const count = valueCounts[label] || 0;

        // Laplace smoothing
        const prob = (count + 1) / ((this.labelCounts[label] || 0) + 1);
        score *= prob;
      }

      scores[label] = score;
    });

    // Return a weighted score (expected value) instead of raw probabilities
    let totalScore = 0;
    let totalWeight = 0;
    labels.forEach(label => {
      totalScore += label * scores[label]; // label is numeric rating
      totalWeight += scores[label];
    });

    return totalWeight ? totalScore / totalWeight : 0;
  }
}

module.exports = NaiveBayes;
