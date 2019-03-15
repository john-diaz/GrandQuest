# grandquest api
Back-end for GrandQuest

## Main technologies
 - Node.js
 - Express
 - PostgreS
 - Mocha/Chai
 - Redis
 - AWS SDK
 
## Project setup
1. Run `npm i`
2. Create a `.env` file in the root of your project directory and then add the following variables:
 - NODE_ENV
 - REDIS_HOST
 - DB_NAME
 - AWS_BUCKET_NAME
 - AWS_ACCESS_KEY
 - AWS_SECRET_ACCESS_KEY 
 - BCRYPT_SALT
 - JWT_KEY
 
## Runs and hot-reloads for development
```
    npm run dev
```

## Running tests
1. Create a `.env.test` file in the root of your project directory 
and add the variables required in `.env` (making changes to fit the tests, 
of course. don't run database tests in your development database!)
2. run `mocha test`