const {queue , active_sessions} = require('../config/database');
const {MessageType} = require("@adiwajshing/baileys");

const helper = {
    isActiveSession: async function(id, bot , stop = false){
        try {
            const activeSess = await active_sessions.findOne({$or: [{user1: id} , {user2: id}]})
            if(activeSess !== null){
                const {user1 , user2} = activeSess
                var target = user1 == id ? user2 : user1
                await active_sessions.remove({id: activeSess.id})
                await bot.sendMessage(target , "Partner mu telah meninggalkan chat !\nketik /find untuk mencari partner baru !" , MessageType.text)
                return true
            }else{
                throw new Error("No Active Session")
            }
            
        }catch(error){
            return error.message == "No Active Session" ? true : false
        }
    }
}

module.exports = helper