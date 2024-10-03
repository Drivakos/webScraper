// migrations/20231001120000-init-clean-db.js

module.exports = {
  async up(db, client) {
    await db.collection('links').createIndex({ url: 1 }, { unique: true });
    await db.collection('links').createIndex({ status: 1 });
    await db.collection('scripts').createIndex({ url: 1 });
  },

  async down(db, client) {
    await db.collection('links').drop();
    await db.collection('scripts').drop();
  }
};
