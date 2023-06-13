const {Client, Intents, ChannelTypes, Collection} = require("oceanic.js")
const config = require("./config.json")
const db = require("./db.json")
const fs = require("fs")
const messageRefs = []
const client = new Client({
    auth : "Bot " +  config.token,
    gateway : {
         
        intents : [Intents.DIRECT_MESSAGE_TYPING,Intents.DIRECT_MESSAGES,Intents.GUILDS,Intents.GUILD_MESSAGES,Intents.MESSAGE_CONTENT,Intents.GUILD_MEMBERS]
    }
})


client.on("ready", () => {
    db.users.forEach(async (user) => {
        const member = await client.rest.users.get(user)
        if(!member) return db.removeUser(user)
         member.createDM()
    })
    console.log("Ready !")

    
})
const sendMessage = async (options,message,member) => {
    for(users of db.users) {
        if(member && users == member.id) continue;
        const user = await client.rest.users.get(users)
        if(!user) return db.removeUser(users)
        const channel = await user.createDM()
        channel.createMessage(options).then((msg) => {
            if(!message) return;
           messageRefs.push({
            user : user.id,
            originalMessage : message.id,
            embedMessage : msg.id
           })
        })
        
    }
}


const sendTyping = async () => {
    for(users of db.users) {
        const user = await client.users.get(users)
        if(!user) return db.removeUser(users)
        const channel = await user.createDM()
        channel.sendTyping()
    }
}

const editMessages = async  (oldMessage,newMessage)=> {
    let newEmbed = {
        author  : {
            iconURL : oldMessage.author.avatarURL(),
            name : oldMessage.author.username
        },
        color : 0x36393e,
    
    }
    if(oldMessage.content) newEmbed.description = oldMessage.content
    if(oldMessage.attachments.size > 0) newEmbed.image = {url :oldMessage.attachments.first().url}
    for (const users of db.users) {
        const user = await client.users.get(users)
        if(!user) return db.removeUser(users)
        if(oldMessage.author.id == user.id) continue;
        const channel = await user.createDM()
        const embedMessage = messageRefs.find((msg) => msg.originalMessage == oldMessage.id)
       
        if(!embedMessage) return;
        const msg = await channel.editMessage(embedMessage.embedMessage,{embeds : [newEmbed]})
        embedMessage.embedMessage = msg.id

    }
    

}



db.addUser = (user,executor) => {
    if(db.users.includes(user.id)) return;
    db.users.push(user.id)
    user.createDM().then((channel) => {
        channel.createMessage({embeds : [
            {
                description  : "You have been added to the group by **" + executor.tag + " **",
                color : 0x36393e
            }
        ]})
    })
    sendMessage({
        embeds : [
            {
                color : 0x36393e,
                description : "The user **" + user.tag + "** has been added to the group by **" + executor.tag + "**",
            }
        ]
    })


    fs.writeFileSync("./db.json", JSON.stringify(db, null, 4))
}
db.removeUser =async  (member,executor) => {
    db.users = db.users.filter((user) => user !== member.id)
    member.createDM().then((channel) => {
        channel.createMessage({embeds : [
            {
                description  : "You have been removed from the group by **" + executor.tag + " **",
                color : 0x36393e
            }
        ]})
    })
   


     fs.writeFileSync("./db.json", JSON.stringify(db, null, 4))
    sendMessage({embeds : [
        {
            description : "The user **" + member.tag + "** has been removed from the group by **" + executor.tag + "**",
            color : 0x36393e
        }
    ]})
}






client.on("messageCreate",async (message) => {

   if(message.author.bot) return;
   if(message.channel.type !== ChannelTypes.GUILD_TEXT) return;
   if(!config.owners.includes(message.author.id)) return;
    if(!message.content.startsWith(config.prefix)) return;
    const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
    const cmd = args.shift().toLowerCase();
    if(cmd == "group") {
        if(!args[0]) return message.channel.createMessage({content : "You need to specify an action !"})
        if(!args[1]) return message.channel.createMessage({content : "You need to specify a user !"})
        const user = await client.rest.users.get(args[1].replace("<@!","").replace(">",""))
        if(!user) return message.channel.createMessage({content : "The user was not found !"})
        switch(args[0]) {
            case "add": 
                db.addUser(user,message.author)
                message.channel.createMessage({content : "The user has been added to the group !"})
                break;
            case "remove": 
                db.removeUser(user,message.author)
                message.channel.createMessage({content : "The user has been removed from the group !"})
                break;
            default:
                break;



     }
    }
})

client.on("messageUpdate",async (newMessage,oldMessage) => {
    if(newMessage.author.bot) return;
    if(newMessage.channel.type !== ChannelTypes.DM) return;
    if(!db.users.includes(oldMessage.author.id)) return;
   
    editMessages(newMessage,oldMessage)
    
})

client.on("messageCreate", (message) => {
    if(message.author.bot) return;
    if(message.channel.type !== ChannelTypes.DM) return;
    if(!db.users.includes(message.author.id)) return;
    let embed = {
        author  : {
            iconURL : message.author.avatarURL(),
            name : message.author.username
        },
        color : 0x36393e,
    }
    if(message.content) embed.description = message.content
    if(message.attachments.size > 0) embed.image = {url : message.attachments.first().url}
    sendMessage({embeds : [embed]},message,message.author)
})

client.on("typingStart", (channel, user) => {
    if(channel.type !== ChannelTypes.DM) return;
    if(!db.users.includes(user.id)) return;
    sendTyping()
})

client.connect()