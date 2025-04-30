import express, { Request, Response } from 'express';
import { PrismaClient, User } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('API is running!');
});

const PORT: number = 5500;
const HOST: string = '0.0.0.0';

app.listen(PORT, HOST, (): void => {
  console.log(`🚀 Server is running at http://${HOST}:${PORT}`);
});
