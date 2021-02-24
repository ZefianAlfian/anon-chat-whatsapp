const {queue , active_sessions} = require('../config/database')

const helper = {
    isActiveSession: async function(id, bot , stop = false){
        try {
            const activeSess = await active_sessions.findOne({$or: [{user1: id} , {user2: id}]})
            if(activeSess !== null){
                const {user1 , user2} = activeSess
                var target = user1 == id ? user2 : user1
                await active_sessions.remove({id: activeSess.id})
                await bot.sendMessage(target , "Partner mu telah meninggalkan chat !\nketik /find untuk mencari partner baru !")
                return true
            }else{
                throw new Error("No Active Session")
            }
            
        }catch(error){
            console.log(error.message)
            return false
        }
    }
}

module.exports = helper