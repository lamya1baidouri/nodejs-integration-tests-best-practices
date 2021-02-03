const request = require('supertest');
const sinon = require('sinon');
const nock = require('nock');
const {
  initializeWebServer,
  stopWebServer,
} = require('../../../example-application/api');
const OrderRepository = require('../../../example-application/data-access/order-repository');

let expressApp, mailerNock;

beforeAll(async (done) => {
  // ️️️✅ Best Practice: Place the backend under test within the same process
  expressApp = await initializeWebServer();
  // ️️️✅ Best Practice: Ensure that this component is isolated by preventing unknown calls except for the api
  nock.disableNetConnect();
  nock.enableNetConnect('127.0.0.1');

  done();
});

beforeEach(() => {
  // ️️️✅ Best Practice: Isolate the service under test by intercepting requests to 3rd party services
  nock('http://localhost/user/').get(`/1`).reply(200, {
    id: 1,
    name: 'John',
  });
  mailerNock = nock('http://localhost').post('/mailer/send').reply(202);
});

afterEach(() => {
  // ️️️✅ Best Practice: Clean nock interceptors and sinon test-doubles between tests
  nock.cleanAll();
  sinon.restore();
});

afterAll(async (done) => {
  // ️️️✅ Best Practice: Clean-up resources after each run
  await stopWebServer();

  // ️️️✅ Best Practice: Clean-up all nocks before the next file starts
  nock.enableNetConnect();
  done();
});

// ️️️✅ Best Practice: Structure tests
describe.skip('/api', () => {
  describe('POST /orders', () => {
    test('When order succeed, send mail to store manager', async () => {
      //Arrange
      process.env.SEND_MAILS = 'true';

      // ️️️✅ Best Practice: Intercept requests for 3rd party services to eliminate undesired side effects like emails or SMS
      // ️️️✅ Best Practice: Save the body when you need to make sure you call the external service as expected
      nock.removeInterceptor({
        hostname: 'localhost',
        method: 'POST',
        path: '/mailer/send',
      });
      let emailPayload;
      nock('http://localhost')
        .post('/mailer/send', (payload) => ((emailPayload = payload), true))
        .reply(202);
      const orderToAdd = {
        userId: 1,
        productId: 2,
        mode: 'approved',
      };

      //Act
      await request(expressApp).post('/order').send(orderToAdd);

      //Assert
      // ️️️✅ Best Practice: Assert that the app called the mailer service appropriately
      expect(emailPayload).toMatchObject({
        subject: expect.any(String),
        body: expect.any(String),
        recipientAddress: expect.stringMatching(
          /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/
        ),
      });
    });

    test('When adding  a new valid order , Then should get back 200 response', async () => {
      //Arrange
      const orderToAdd = {
        userId: 1,
        productId: 2,
        mode: 'approved',
      };

      //Act
      // ➿ Nock intercepts the request for users service as declared in the BeforeAll function
      const orderAddResult = await request(expressApp)
        .post('/order')
        .send(orderToAdd);

      //Assert
      expect(orderAddResult.status).toBe(200);
    });

    tests.skip('When the user does not exist, return http 404', async () => {
      //Arrange
      // ️️️✅ Best Practice: Simulate 3rd party service responses to test different scenarios like 404, 422 or 500.
      //                    Use specific params (like ids) to easily bypass the beforeEach interceptor.
      nock('http://localhost/user/').get(`/7`).reply(404, {
        message: 'User does not exist',
        code: 'nonExisting',
      });
      const orderToAdd = {
        userId: 7,
        productId: 2,
        mode: 'draft',
      };

      //Act
      const orderAddResult = await request(expressApp)
        .post('/order')
        .send(orderToAdd);

      //Assert
      expect(orderAddResult.status).toBe(404);
    });
  });
});
