import React, { useState, useEffect, useRef } from 'react'
import { 
  Send, 
  Paperclip, 
  Smile, 
  Image, 
  Search, 
  Phone, 
  Video, 
  MoreVertical, 
  User,
  Check,
  CheckCheck,
  Clock,
  X,
  Plus,
  Mic,
  MicOff,
  VideoOff,
  MessageSquare
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-hot-toast'

interface Message {
  id: string
  sender_id: string
  receiver_id: string | null
  content: string
  read: boolean
  attachments: string[] | null
  created_at: string
  sender?: {
    full_name: string
    avatar_url: string | null
  }
}

interface Contact {
  id: string
  full_name: string
  avatar_url: string | null
  last_active: string | null
  unread_count: number
  last_message?: {
    content: string
    created_at: string
  }
}

export default function Chat() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messageInput, setMessageInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [showNewMessageModal, setShowNewMessageModal] = useState(false)
  const [newMessageRecipient, setNewMessageRecipient] = useState('')
  const [availableUsers, setAvailableUsers] = useState<{id: string, full_name: string}[]>([])
  const [isInCall, setIsInCall] = useState(false)
  const [callType, setCallType] = useState<'audio' | 'video' | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user) {
      loadContacts()
      loadAvailableUsers()
    }
    
    // Set up real-time subscription for new messages
    const messageSubscription = supabase
      .channel('chat-messages')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `receiver_id=eq.${user?.id}`
      }, () => {
        loadContacts()
        if (selectedContact) {
          loadMessages(selectedContact.id)
        }
      })
      .subscribe()
    
    return () => {
      messageSubscription.unsubscribe()
    }
  }, [user])

  useEffect(() => {
    if (messages.length > 0) {
      // Scroll to bottom when messages change
      scrollToBottom()
    }
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadContacts = async () => {
    try {
      setLoading(true)
      
      if (!user) {
        console.error('No user found');
        return;
      }
      
      // Get all users except current user
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, last_active')
        .neq('id', user?.id)
        .order('full_name')
      
      if (usersError) {
        console.error('Database error:', usersError)
        return
      }
      
      if (!usersData) {
        setContacts([])
        return
      }
      
      // Get last message and unread count for each contact
      const contactsWithMessages: Contact[] = []
      
      for (const contact of usersData) {
        // Get last message
        const { data: lastMessageData, error: lastMessageError } = await supabase
          .from('chat_messages')
          .select('content, created_at')
          .or(`sender_id.eq.${contact.id},receiver_id.eq.${contact.id}`)
          .order('created_at', { ascending: false })
          .limit(1)
        
        if (lastMessageError) {
          console.error('Database error:', lastMessageError)
          continue
        }
        
        // Get unread count
        const { count: unreadCount, error: unreadError } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_id', contact.id)
          .eq('receiver_id', user?.id)
          .eq('read', false)
        
        if (unreadError) {
          console.error('Database error:', unreadError)
          continue
        }
        
        contactsWithMessages.push({
          id: contact.id,
          full_name: contact.full_name,
          avatar_url: contact.avatar_url,
          last_active: contact.last_active,
          unread_count: unreadCount || 0,
          last_message: lastMessageData && lastMessageData.length > 0 ? {
            content: lastMessageData[0].content,
            created_at: lastMessageData[0].created_at
          } : undefined
        })
      }
      
      // Sort contacts by last message time
      contactsWithMessages.sort((a, b) => {
        if (!a.last_message && !b.last_message) return 0
        if (!a.last_message) return 1
        if (!b.last_message) return -1
        return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime()
      })
      
      setContacts(contactsWithMessages)
    } catch (error) {
      console.error('Hiba a kontaktok betöltésekor:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableUsers = async () => {
    try {
      if (!user) {
        console.error('No user found');
        return;
      }
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .neq('id', user?.id)
        .order('full_name')
      
      if (error) {
        console.error('Database error:', error)
        return
      }
      
      if (data) {
        setAvailableUsers(data)
      }
    } catch (error) {
      console.error('Hiba a felhasználók betöltésekor:', error)
    }
  }

  const loadMessages = async (contactId: string) => {
    try {
      setLoadingMessages(true)
      
      if (!user) {
        console.error('No user found');
        return;
      }
      
      // Get messages between current user and selected contact
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender:profiles!chat_messages_sender_id_fkey(full_name, avatar_url)
        `)
        .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${user?.id})`)
        .order('created_at')
      
      if (error) {
        console.error('Database error:', error)
        return
      }
      
      if (data) {
        setMessages(data)
        
        // Mark messages as read
        const unreadMessages = data.filter(msg => msg.sender_id === contactId && !msg.read)
        
        if (unreadMessages.length > 0) {
          const { error: updateError } = await supabase
            .from('chat_messages')
            .update({ read: true })
            .in('id', unreadMessages.map(msg => msg.id))
          
          if (updateError) {
            console.error('Database error:', updateError)
          } else {
            // Update contacts list to reflect read messages
            loadContacts()
          }
        }
      }
    } catch (error) {
      console.error('Hiba az üzenetek betöltésekor:', error)
    } finally {
      setLoadingMessages(false)
    }
  }

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedContact) return
    
    if (!user) {
      console.error('No user found');
      toast.error('Nincs bejelentkezett felhasználó');
      return;
    }
    
    try {
      // Create message
      const messageData = {
        sender_id: user?.id,
        receiver_id: selectedContact.id,
        content: messageInput,
        read: false
      }
      
      // Insert into database
      const { error } = await supabase
        .from('chat_messages')
        .insert(messageData)
      
      if (error) {
        console.error('Database error:', error)
        toast.error('Hiba az üzenet küldésekor')
        return
      }
      
      // Clear input
      setMessageInput('')
      
      // Reload messages
      loadMessages(selectedContact.id)
    } catch (error) {
      console.error('Hiba az üzenet küldésekor:', error)
      toast.error('Hiba az üzenet küldésekor')
    }
  }

  const handleStartNewChat = async () => {
    if (!newMessageRecipient) {
      toast.error('Kérjük válasszon címzettet')
      return
    }
    
    if (!user) {
      console.error('No user found');
      toast.error('Nincs bejelentkezett felhasználó');
      return;
    }
    
    // Find the contact
    const contact = contacts.find(c => c.id === newMessageRecipient)
    
    if (contact) {
      setSelectedContact(contact)
      loadMessages(contact.id)
    } else {
      // Get user details
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, last_active')
        .eq('id', newMessageRecipient)
        .single()
      
      if (error) {
        console.error('Database error:', error)
        toast.error('Hiba a felhasználó betöltésekor')
        return
      }
      
      if (data) {
        const newContact: Contact = {
          id: data.id,
          full_name: data.full_name,
          avatar_url: data.avatar_url,
          last_active: data.last_active,
          unread_count: 0
        }
        
        setSelectedContact(newContact)
        setContacts(prev => [newContact, ...prev])
        loadMessages(newContact.id)
      }
    }
    
    setShowNewMessageModal(false)
    setNewMessageRecipient('')
  }

  const handleStartCall = (type: 'audio' | 'video') => {
    if (!selectedContact) return
    
    setCallType(type)
    setIsInCall(true)
    
    // In a real app, this would initiate a WebRTC call
    toast.success(`${type === 'audio' ? 'Hang' : 'Videó'}hívás indítása ${selectedContact.full_name} felhasználóval`)
  }

  const handleEndCall = () => {
    setIsInCall(false)
    setCallType(null)
    setIsMuted(false)
    setIsVideoOff(false)
    
    // In a real app, this would end the WebRTC call
    toast.success('Hívás befejezve')
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (date.toDateString() === today.toDateString()) {
      return 'Ma'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Tegnap'
    } else {
      return date.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })
    }
  }

  const filteredContacts = contacts.filter(contact => 
    contact.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="flex h-[calc(100vh-10rem)] overflow-hidden rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Contacts Sidebar */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Search and New Chat */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Keresés..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <button
            onClick={() => setShowNewMessageModal(true)}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            Új beszélgetés
          </button>
        </div>
        
        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-8">
              <User className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400">Nincsenek kontaktok</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  onClick={() => {
                    setSelectedContact(contact)
                    loadMessages(contact.id)
                  }}
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                    selectedContact?.id === contact.id ? 'bg-gray-100 dark:bg-gray-700' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center overflow-hidden">
                        {contact.avatar_url ? (
                          <img 
                            src={contact.avatar_url} 
                            alt={contact.full_name} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="h-6 w-6 text-gray-400" />
                        )}
                      </div>
                      {contact.last_active && new Date(contact.last_active).getTime() > Date.now() - 15 * 60 * 1000 && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {contact.full_name}
                        </h3>
                        {contact.last_message && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {contact.last_message.created_at ? formatTime(contact.last_message.created_at) : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {contact.last_message?.content || 'Nincs üzenet'}
                        </p>
                        {contact.unread_count > 0 && (
                          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-600 rounded-full">
                            {contact.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedContact ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center overflow-hidden mr-3">
                  {selectedContact.avatar_url ? (
                    <img 
                      src={selectedContact.avatar_url} 
                      alt={selectedContact.full_name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {selectedContact.full_name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedContact.last_active && new Date(selectedContact.last_active).getTime() > Date.now() - 15 * 60 * 1000
                      ? 'Online'
                      : selectedContact.last_active
                        ? `Utoljára aktív: ${formatTime(selectedContact.last_active)}`
                        : 'Offline'
                    }
                  </p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={() => handleStartCall('audio')}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Phone className="h-5 w-5" />
                </button>
                <button 
                  onClick={() => handleStartCall('video')}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Video className="h-5 w-5" />
                </button>
                <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {/* Call UI */}
            {isInCall && (
              <div className="relative bg-gray-900 h-64 flex items-center justify-center">
                {callType === 'video' && !isVideoOff ? (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    <div className="text-white text-center">
                      <Video className="h-12 w-12 mx-auto mb-2" />
                      <p>Videóhívás folyamatban...</p>
                      <p className="text-sm text-gray-400">{selectedContact.full_name}</p>
                    </div>
                    
                    {/* Self view */}
                    <div className="absolute bottom-4 right-4 w-32 h-24 bg-gray-700 rounded-lg flex items-center justify-center">
                      <User className="h-8 w-8 text-gray-400" />
                    </div>
                  </div>
                ) : (
                  <div className="text-white text-center">
                    <Phone className="h-12 w-12 mx-auto mb-2" />
                    <p>{callType === 'audio' ? 'Hanghívás' : 'Videóhívás'} folyamatban...</p>
                    <p className="text-sm text-gray-400">{selectedContact.full_name}</p>
                  </div>
                )}
                
                {/* Call controls */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-4">
                  <button 
                    onClick={() => setIsMuted(!isMuted)}
                    className={`p-3 rounded-full ${isMuted ? 'bg-red-600' : 'bg-gray-700'}`}
                  >
                    {isMuted ? <MicOff className="h-5 w-5 text-white" /> : <Mic className="h-5 w-5 text-white" />}
                  </button>
                  
                  {callType === 'video' && (
                    <button 
                      onClick={() => setIsVideoOff(!isVideoOff)}
                      className={`p-3 rounded-full ${isVideoOff ? 'bg-red-600' : 'bg-gray-700'}`}
                    >
                      {isVideoOff ? <VideoOff className="h-5 w-5 text-white" /> : <Video className="h-5 w-5 text-white" />}
                    </button>
                  )}
                  
                  <button 
                    onClick={handleEndCall}
                    className="p-3 rounded-full bg-red-600"
                  >
                    <Phone className="h-5 w-5 text-white transform rotate-135" />
                  </button>
                </div>
              </div>
            )}
            
            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50 dark:bg-gray-900">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mb-4">
                    <MessageSquare className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">Nincs üzenet</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    Kezdjen el beszélgetni {selectedContact.full_name} felhasználóval
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => {
                    // Check if we need to show date separator
                    const showDateSeparator = index === 0 || 
                      formatDate(messages[index-1].created_at) !== formatDate(message.created_at)
                    
                    const isCurrentUser = message.sender_id === user?.id
                    
                    return (
                      <React.Fragment key={message.id}>
                        {showDateSeparator && (
                          <div className="flex justify-center my-4">
                            <div className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-xs text-gray-600 dark:text-gray-300">
                              {formatDate(message.created_at)}
                            </div>
                          </div>
                        )}
                        <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                          {!isCurrentUser && (
                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex-shrink-0 flex items-center justify-center overflow-hidden mr-2">
                              {message.sender?.avatar_url ? (
                                <img 
                                  src={message.sender.avatar_url} 
                                  alt={message.sender.full_name} 
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <User className="h-4 w-4 text-gray-400" />
                              )}
                            </div>
                          )}
                          <div className={`max-w-xs md:max-w-md lg:max-w-lg ${isCurrentUser ? 'order-1' : 'order-2'}`}>
                            <div className={`px-4 py-2 rounded-lg ${
                              isCurrentUser 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                            }`}>
                              <p>{message.content}</p>
                            </div>
                            <div className={`flex items-center mt-1 text-xs ${
                              isCurrentUser ? 'justify-end' : 'justify-start'
                            }`}>
                              <span className="text-gray-500 dark:text-gray-400">
                                {formatTime(message.created_at)}
                              </span>
                              {isCurrentUser && (
                                <span className="ml-1 text-gray-500 dark:text-gray-400">
                                  {message.read ? (
                                    <CheckCheck className="h-3 w-3 text-blue-500" />
                                  ) : (
                                    <Check className="h-3 w-3" />
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
            
            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                  <Paperclip className="h-5 w-5" />
                </button>
                <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                  <Image className="h-5 w-5" />
                </button>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Írjon üzenetet..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                    <Smile className="h-5 w-5" />
                  </button>
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim()}
                  className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mb-4">
              <MessageSquare className="h-10 w-10 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
              Válasszon beszélgetést
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md">
              Válasszon egy kontaktot a beszélgetéshez, vagy indítson új beszélgetést a "Új beszélgetés" gombbal.
            </p>
            <button
              onClick={() => setShowNewMessageModal(true)}
              className="mt-6 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
            >
              <Plus className="h-5 w-5 mr-2" />
              Új beszélgetés
            </button>
          </div>
        )}
      </div>

      {/* New Message Modal */}
      {showNewMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Új beszélgetés
                </h2>
                <button
                  onClick={() => setShowNewMessageModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Címzett *
                  </label>
                  <select
                    value={newMessageRecipient}
                    onChange={(e) => setNewMessageRecipient(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="">Válasszon címzettet</option>
                    {availableUsers.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowNewMessageModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Mégse
                </button>
                <button
                  onClick={handleStartNewChat}
                  disabled={!newMessageRecipient}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Indítás
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}