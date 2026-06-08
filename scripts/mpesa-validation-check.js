const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const bookings = await client.query(
    'select id, "userId", status, total from "Booking" order by id desc limit 5',
  );
  const payments = await client.query(
    'select id, "bookingId", status, "mpesaTxId", "processedAt", "receiptNumber", "resultCode", "resultDesc" from "Payment" order by id desc limit 10',
  );

  console.log('BOOKINGS');
  console.log(JSON.stringify(bookings.rows, null, 2));
  console.log('PAYMENTS');
  console.log(JSON.stringify(payments.rows, null, 2));

  await client.end();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
