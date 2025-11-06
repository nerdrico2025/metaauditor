import bcrypt from 'bcryptjs';
import { db } from '../src/infrastructure/database/connection';
import {
  users,
  posts,
  categories,
  tags,
  comments,
  PostCategory,
  PostTag,
} from '../src/infrastructure/database/schema';

export async function checkIfDatabaseEmpty(): Promise<boolean> {
  try {
    const result = await db.query.users.count();
    return result === 0;
  } catch (error) {
    console.error('Error checking if database is empty:', error);
    throw error;
  }
}

export async function seedData(): Promise<void> {
  console.log('Seeding database...');

  const password = await bcrypt.hash('password123', 10);

  try {
    await db.insert(users).values([
      {
        username: 'john_doe',
        email: 'john.doe@example.com',
        password: password,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        username: 'jane_smith',
        email: 'jane.smith@example.com',
        password: password,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    const createdUsers = await db.query.users.findMany();
    const userId1 = createdUsers[0].id;
    const userId2 = createdUsers[1].id;

    await db.insert(categories).values([
      { name: 'Technology', created_at: new Date(), updated_at: new Date() },
      { name: 'Programming', created_at: new Date(), updated_at: new Date() },
    ]);

    const createdCategories = await db.query.categories.findMany();
    const categoryId1 = createdCategories[0].id;
    const categoryId2 = createdCategories[1].id;

    await db.insert(tags).values([
      { name: 'Drizzle', created_at: new Date(), updated_at: new Date() },
      { name: 'Node.js', created_at: new Date(), updated_at: new Date() },
      { name: 'Express', created_at: new Date(), updated_at: new Date() },
    ]);

    const createdTags = await db.query.tags.findMany();
    const tagId1 = createdTags[0].id;
    const tagId2 = createdTags[1].id;
    const tagId3 = createdTags[2].id;

    await db.insert(posts).values([
      {
        title: 'Introduction to Drizzle ORM',
        content: 'Drizzle ORM is a lightweight ORM for TypeScript.',
        user_id: userId1,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        title: 'Getting Started with Node.js',
        content: 'Node.js is a JavaScript runtime built on Chrome\'s V8 JavaScript engine.',
        user_id: userId2,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        title: 'Building APIs with Express.js',
        content: 'Express.js is a minimal and flexible Node.js web application framework.',
        user_id: userId1,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    const createdPosts = await db.query.posts.findMany();
    const postId1 = createdPosts[0].id;
    const postId2 = createdPosts[1].id;
    const postId3 = createdPosts[2].id;

    await db.batch([
      db.insert(PostCategory).values([{ post_id: postId1, category_id: categoryId1 }]),
      db.insert(PostCategory).values([{ post_id: postId2, category_id: categoryId2 }]),
      db.insert(PostCategory).values([{ post_id: postId3, category_id: categoryId2 }]),
      db.insert(PostTag).values([{ post_id: postId1, tag_id: tagId1 }]),
      db.insert(PostTag).values([{ post_id: postId1, tag_id: tagId2 }]),
      db.insert(PostTag).values([{ post_id: postId2, tag_id: tagId2 }]),
      db.insert(PostTag).values([{ post_id: postId3, tag_id: tagId3 }]),
    ]);

    await db.insert(comments).values([
      {
        post_id: postId1,
        user_id: userId2,
        content: 'Great explanation!',
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        post_id: postId2,
        user_id: userId1,
        content: 'Very helpful tutorial.',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);

    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

seedData();