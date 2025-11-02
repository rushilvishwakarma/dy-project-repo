## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/viraj-sh/project-repository
cd project-repository
```

---

### 2. Set up environment variables

Copy the example environment file and update it:

```bash
cp .env.example .env
```

Update the `.env` file with the following values:

```env
# Provider Redirect URI (GitHub)
REDIRECT_URI=

# Supabase URL and key (Settings → API Keys → service_role)
SUPABASE_URL=
SUPABASE_KEY=
```

---

### 3. Create and configure a Supabase project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) and create a new project.
2. In your project, navigate to **Settings → API Keys** and copy:

   - `SUPABASE_URL`
   - `service_role` key
     Paste these values into your `.env` file.

3. Go to **Authentication → Providers → GitHub** in the Supabase dashboard and enable GitHub as a provider.

---

### 4. Create a GitHub OAuth App

1. Visit [GitHub Developer Settings](https://github.com/settings/developers) and click **New OAuth App**.
2. Fill out the required fields:

   - **Application name:** any name for your app
   - **Homepage URL:** any valid URL (can be temporary/test)
   - **Authorization callback URL:** copy the callback URL provided by Supabase for the GitHub provider.

3. Click **Register application**.
4. Copy the **Client ID** and **Client Secret** from GitHub and enter them in the GitHub provider setup in Supabase.

---

### 5. Database Setup

Before running the backend, create the `user_tokens` table and set up a trigger to automatically update the `updated_at` column on updates.

1. Go to **Supabase Dashboard → SQL Editor**.
2. Run the following queries:

```sql
-- Create the table for storing GitHub tokens
create table if not exists user_tokens (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  github_token text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create a function to auto-update 'updated_at' timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Create a trigger to call the function before updating a row
create trigger update_user_tokens_updated_at
before update on user_tokens
for each row
execute function update_updated_at_column();
```

This ensures that whenever a row in `user_tokens` is updated, the `updated_at` column is automatically set to the current timestamp.

---

### 6. Run the backend locally

You can start the FastAPI app in one of two ways:

#### Development mode (auto-reload)

```bash
uvicorn app:app --reload
```

#### Standard mode

```bash
python app.py
```

---

## Swagger UI

Once the backend is running, you can access the API documentation and test endpoints at:

```
http://localhost:8000/docs
```

Use the **Authorize** button in the top-right corner to input your Supabase access token for authenticated endpoints.

---

## Authentication Flow

1. Call the `/login` endpoint to get the GitHub OAuth URL.
2. Users log in with GitHub via the provided URL.
3. After successful login, GitHub redirects the user to a URL similar to:

```
http://localhost:3000/#access_token=<supabase_access_token>&provider_token=<github_token>&...
```

- `access_token`: Supabase JWT token used for authentication in backend requests.
- `provider_token`: GitHub OAuth token, which the frontend must send to the backend for storage.

---

### Storing GitHub Token

The frontend should store the `provider_token` (GitHub token) by calling:

```
POST /api/auth/supabase/store-github-token
```

**Request Body:**

```json
{
  "github_token": "string"
}
```

This stores or updates the user’s GitHub token in Supabase. The other endpoints rely on this token to fetch GitHub data. Without it, the functionality of fetching GitHub user information will not work.
