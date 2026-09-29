import { describe, it, expect } from '@jest/globals';
import openApiToBruno from '../../../src/openapi/openapi-to-bruno';
import swagger2ToBruno from '../../../src/openapi/swagger2-to-bruno';
import { findRequestByName } from '../../common/find-items';

const soldoHeaderParams = [
  { name: 'soldo-principalId', in: 'header', required: true, schema: { type: 'string', example: 'principal-from-spec' } },
  { name: 'soldo-accountId', in: 'header', required: true, schema: { type: 'string', example: 'account-from-spec' } },
  { name: 'soldo-viewId', in: 'header', required: true, schema: { type: 'string', example: 'view-from-spec' } }
];

const buildSpec = ({ title, parameters = soldoHeaderParams }) => ({
  openapi: '3.0.0',
  info: { title, version: '1.0.0' },
  paths: {
    '/transactions': {
      get: {
        operationId: 'listTransactions',
        summary: 'List transactions',
        parameters,
        responses: {
          200: {
            description: 'Success',
            content: { 'application/json': { example: { items: [] } } }
          }
        }
      }
    }
  }
});

describe('OpenAPI Import - Soldo shared headers', () => {
  it('moves the shared identity headers to the collection root for sld- collections', () => {
    const result = openApiToBruno(buildSpec({ title: 'sld-product-transaction-system' }));

    expect(result.root.request.headers).toEqual([
      expect.objectContaining({ name: 'soldo-principalId', value: '{{principalId}}', enabled: true }),
      expect.objectContaining({ name: 'soldo-accountId', value: '{{accountId}}', enabled: true }),
      expect.objectContaining({ name: 'soldo-viewId', value: '{{viewId}}', enabled: true })
    ]);

    const request = findRequestByName(result.items, 'List transactions');
    expect(request.request.headers).toEqual([]);
  });

  it('strips the shared headers from generated examples too', () => {
    const result = openApiToBruno(buildSpec({ title: 'sld-cards' }));
    const request = findRequestByName(result.items, 'List transactions');

    expect(request.examples.length).toBeGreaterThan(0);
    request.examples.forEach((example) => {
      expect(example.request.headers).toEqual([]);
    });
  });

  it('leaves non-shared headers on the request', () => {
    const result = openApiToBruno(
      buildSpec({
        title: 'sld-cards',
        parameters: [
          ...soldoHeaderParams,
          { name: 'x-request-id', in: 'header', required: true, schema: { type: 'string', example: 'abc' } }
        ]
      })
    );
    const request = findRequestByName(result.items, 'List transactions');

    expect(request.request.headers).toEqual([
      expect.objectContaining({ name: 'x-request-id', value: 'abc' })
    ]);
  });

  it('only hoists the shared headers the spec actually uses', () => {
    const result = openApiToBruno(
      buildSpec({
        title: 'sld-cards',
        parameters: [soldoHeaderParams[0]]
      })
    );

    expect(result.root.request.headers).toEqual([
      expect.objectContaining({ name: 'soldo-principalId', value: '{{principalId}}' })
    ]);
  });

  it('leaves collections without the sld- prefix untouched', () => {
    const result = openApiToBruno(buildSpec({ title: 'product-transaction-system' }));
    const request = findRequestByName(result.items, 'List transactions');

    expect(result.root.request.headers).toBeUndefined();
    expect(request.request.headers).toEqual([
      expect.objectContaining({ name: 'soldo-principalId', value: 'principal-from-spec' }),
      expect.objectContaining({ name: 'soldo-accountId', value: 'account-from-spec' }),
      expect.objectContaining({ name: 'soldo-viewId', value: 'view-from-spec' })
    ]);
  });

  it('adds no collection headers when a sld- collection uses none of them', () => {
    const result = openApiToBruno(
      buildSpec({
        title: 'sld-cards',
        parameters: [{ name: 'x-request-id', in: 'header', required: true, schema: { type: 'string', example: 'abc' } }]
      })
    );

    expect(result.root.request.headers).toBeUndefined();
  });

  it('applies to swagger 2.0 specs as well', () => {
    const result = swagger2ToBruno({
      swagger: '2.0',
      info: { title: 'sld-legacy-api', version: '1.0.0' },
      paths: {
        '/transactions': {
          get: {
            operationId: 'listTransactions',
            summary: 'List transactions',
            parameters: [
              { name: 'soldo-principalId', in: 'header', required: true, type: 'string' },
              { name: 'soldo-accountId', in: 'header', required: true, type: 'string' },
              { name: 'soldo-viewId', in: 'header', required: true, type: 'string' }
            ],
            responses: { 200: { description: 'Success' } }
          }
        }
      }
    });

    expect(result.root.request.headers).toEqual([
      expect.objectContaining({ name: 'soldo-principalId', value: '{{principalId}}' }),
      expect.objectContaining({ name: 'soldo-accountId', value: '{{accountId}}' }),
      expect.objectContaining({ name: 'soldo-viewId', value: '{{viewId}}' })
    ]);

    const request = findRequestByName(result.items, 'List transactions');
    expect(request.request.headers).toEqual([]);
  });
});
