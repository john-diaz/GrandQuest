const AWS = require('aws-sdk');

console.log('$ AWS : connecting to aws s3 using access key ', process.env.AWS_ACCESS_KEY)

// Create an S3 client
const S3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  signatureVersion: 'v4',
  region: 'us-east-2',
});

// Export multiple AWS services
module.exports = {
  S3,
};
