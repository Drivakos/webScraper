module.exports = {
  async up(db) {
    // Create the 'links' collection
    await db.createCollection('links');
    console.log("Created 'links' collection.");

    // Create the 'scripts' collection
    await db.createCollection('scripts');
    console.log("Created 'scripts' collection.");

    // Create the 'scraped_data' collection
    await db.createCollection('scraped_data');
    console.log("Created 'scraped_data' collection.");

    // Optionally, create indexes for optimized queries
    await db.collection('links').createIndex({ url: 1 }, { unique: true });
    console.log("Created index on 'url' field in 'links' collection.");
  },

  async down(db) {
    // Rollback logic to drop collections if needed
    await db.collection('links').drop();
    console.log("Dropped 'links' collection.");

    await db.collection('scripts').drop();
    console.log("Dropped 'scripts' collection.");

    await db.collection('scraped_data').drop();
    console.log("Dropped 'scraped_data' collection.");
  }
};
