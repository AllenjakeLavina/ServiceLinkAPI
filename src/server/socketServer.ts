import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { PrismaClient, NotificationType } from '@prisma/client';

const prisma = new PrismaClient();

// Socket user mapping - to track which user is connected to which socket
const connectedUsers = new Map<string, string[]>(); // userId -> socketId[]

// Interface for decoded token
interface DecodedToken {
  id: string;
  email: string;
  role: string;
  isVerified: boolean;
  clientId?: string;
  providerId?: string;
  providerVerificationStatus?: string;
  iat: number;
  exp: number;
}

interface SocketData {
  user: DecodedToken;
}

export const setupSocketServer = (httpServer: HttpServer) => {
  const io = new SocketIOServer(httpServer, {
    path: '/socket',
    transports: ['websocket', 'polling'],
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Middleware to authenticate socket connections
  io.use((socket: Socket, next: (err?: Error) => void) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication token is required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as DecodedToken;
      (socket.data as SocketData).user = decoded;
      next();
    } catch (error) {
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);
    
    const userId = (socket.data as SocketData).user?.id;
    
    if (userId) {
      // Store socket connection for the user
      if (!connectedUsers.has(userId)) {
        connectedUsers.set(userId, []);
      }
      connectedUsers.get(userId)?.push(socket.id);
      
      // Join user to their own room for targeted messages
      socket.join(`user:${userId}`);
      
      // Notify user they are connected
      socket.emit('connected', { message: 'You are connected to the chat server' });
    }

    // Handle joining a specific conversation
    socket.on('join-conversation', (conversationId: string) => {
      if (!userId) return;
      
      // Join the conversation room
      socket.join(`conversation:${conversationId}`);
      console.log(`User ${userId} joined conversation ${conversationId}`);
    });

    // Handle leaving a conversation
    socket.on('leave-conversation', (conversationId: string) => {
      if (!userId) return;
      
      // Leave the conversation room
      socket.leave(`conversation:${conversationId}`);
      console.log(`User ${userId} left conversation ${conversationId}`);
    });

    // Handle new message
    socket.on('new-message', async ({ conversationId, content, imageUrl }: { conversationId: string, content: string, imageUrl?: string }) => {
      if (!userId || !conversationId) return;

      try {
        // Get conversation to find the other user
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { user1Id: true, user2Id: true }
        });

        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }

        // Check if user is part of this conversation
        if (conversation.user1Id !== userId && conversation.user2Id !== userId) {
          socket.emit('error', { message: 'You are not authorized to send messages in this conversation' });
          return;
        }

        // Determine the recipient
        const recipientId = conversation.user1Id === userId ? conversation.user2Id : conversation.user1Id;

        // Create the message in database
        const message = await prisma.message.create({
          data: {
            conversationId,
            senderId: userId,
            receiverId: recipientId,
            content: content || '',
            imageUrl,
            isRead: false
          },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePicture: true
              }
            }
          }
        });

        // Format the message for the client
        const formattedMessage = {
          id: message.id,
          content: message.content,
          imageUrl: message.imageUrl,
          createdAt: message.createdAt,
          isRead: message.isRead,
          sender: {
            id: message.sender.id,
            firstName: message.sender.firstName,
            lastName: message.sender.lastName,
            profilePicture: message.sender.profilePicture
          }
        };

        // Broadcast to the conversation room
        io.to(`conversation:${conversationId}`).emit('message', formattedMessage);

        // Also send to specific user's room if they're not in the conversation room
        // This ensures offline users will get the message when they come online
        io.to(`user:${recipientId}`).emit('new-message-notification', {
          conversationId,
          message: formattedMessage
        });

        // Create a notification
        try {
          await prisma.notification.create({
            data: {
              receiverId: recipientId,
              type: 'NEW_MESSAGE',
              title: 'New Message',
              message: `${message.sender.firstName} sent you a message`,
              data: JSON.stringify({
                conversationId,
                messageId: message.id,
                senderId: userId
              }),
              isRead: false
            }
          });
        } catch (notifError) {
          console.error('Error creating notification:', notifError);
          // Continue even if notification creation fails
        }

        // Update the conversation's updatedAt timestamp
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() }
        });
      } catch (error) {
        console.error('Error handling new message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle read receipts
    socket.on('mark-read', async ({ conversationId }: { conversationId: string }) => {
      if (!userId || !conversationId) return;

      try {
        // Mark all messages as read
        await prisma.message.updateMany({
          where: {
            conversationId,
            receiverId: userId,
            isRead: false
          },
          data: {
            isRead: true
          }
        });

        // Notify the sender that messages were read
        io.to(`conversation:${conversationId}`).emit('messages-read', {
          conversationId,
          readBy: userId
        });
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    });

    // Handle typing indicator
    socket.on('typing', ({ conversationId, isTyping }: { conversationId: string, isTyping: boolean }) => {
      if (!userId || !conversationId) return;
      
      // Broadcast typing status to the conversation
      socket.to(`conversation:${conversationId}`).emit('user-typing', {
        conversationId,
        userId,
        isTyping
      });
    });

    // Handle notifications
    socket.on('send-notification', async ({ recipientId, type, title, message, data }: { recipientId: string, type: NotificationType, title: string, message: string, data?: any }) => {
      if (!userId || !recipientId) return;

      try {
        // Store notification in database
        const notification = await prisma.notification.create({
          data: {
            receiverId: recipientId,
            type,
            title,
            message,
            data: data ? JSON.stringify(data) : null,
            isRead: false
          }
        });

        // Send to recipient if online
        io.to(`user:${recipientId}`).emit('notification', {
          id: notification.id,
          type,
          title,
          message,
          data,
          createdAt: notification.createdAt,
          isRead: false
        });
      } catch (error) {
        console.error('Error sending notification:', error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      
      if (userId) {
        // Remove this socket from user's connections
        const userSockets = connectedUsers.get(userId) || [];
        const updatedSockets = userSockets.filter(id => id !== socket.id);
        
        if (updatedSockets.length > 0) {
          connectedUsers.set(userId, updatedSockets);
        } else {
          connectedUsers.delete(userId);
        }
      }
    });
  });

  return io;
};
