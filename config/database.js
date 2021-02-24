require('dotenv').config()
const monk = require('monk')

const db = monk(process.env.MONGO_URI)

const database = {
    queue: db.get('queue'),
    active_sessions: db.get('active_sessions')
}

module.exports = database