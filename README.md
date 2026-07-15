# Next.js template

This is a Next.js template with shadcn/ui.

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import project in Vercel dashboard.
3. Set environment variable in Vercel project settings:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require&channel_binding=require
```

4. Deploy.

Database connection check endpoint:

```txt
/api/db
```

Vercel config is defined in `vercel.json`.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```
