
---

### **Server Side README.md**  

```markdown
# Newspaper FullStack Website - Server

This is the **backend** for the Newspaper FullStack Website, built with **Node.js**, **Express**, and **MongoDB**. It handles authentication, article management, subscription logic, and admin functionalities.

## Admin Credentials (For testing)
- **Email:** admin@example.com  
- **Password:** Admin@123  

## Live Site
[Live Demo Link](https://newspaper-fullstack-server-chi.vercel.app/)

## Key Features
1. JWT-based authentication for private routes.
2. CRUD operations for articles (add, update, delete, approve, decline, make premium).
3. Limit article posting for **normal users** (1 article) and unlimited for **premium users**.
4. Subscription logic with **premiumTaken timestamp** to track subscription validity.
5. Pagination on admin dashboard pages (All Users, All Articles).
6. Publisher management for admins (Add Publisher with logo upload).
7. Article approval system: pending, approved, declined with reason.
8. Premium articles accessible only for users with an active subscription.
9. Backend search and filter for articles by title, publisher, or tags.
10. Increase article **view count** on every article details visit.
11. Environment variables for Firebase config keys and MongoDB credentials.
12. REST API endpoints for all major functionalities.
13. Proper error handling and validation for all requests.
14. Optional: Image upload handled via imgbb/Cloudinary.
15. Implements best practices for scalable and secure API development.

## Tech Stack
- Node.js (Backend runtime)
- Express (Web framework)
- MongoDB & Mongoose (Database)
- Firebase Admin SDK (Authentication)
- JWT (Authentication & route protection)
- imgbb / Cloudinary (Image hosting)
- dotenv (Environment variables)
- bcrypt (Password hashing)
- CORS (Cross-origin requests)

## Installation
1. Clone the repository:  
```bash
git clone <server-repo-url>
