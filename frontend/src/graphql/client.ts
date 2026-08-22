import { ApolloClient, InMemoryCache, HttpLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';

const httpLink = new HttpLink({
  uri: 'http://localhost:4000/graphql',
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, extensions }) => {
      console.error(`[GraphQL error]: Message: ${message}, Code: ${extensions?.code}`);
      // In a real app, we might dispatch this to a toast/snackbar context
    });
  }
  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
  }
});

export const client = new ApolloClient({
  link: from([errorLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          bookings: {
            keyArgs: ['resourceId', 'status'],
            merge(existing, incoming, { args }) {
              if (!existing) return incoming;
              if (!args?.after) return incoming; // If there's no cursor, we're likely replacing
              
              // Keyset pagination merge
              return {
                ...incoming,
                edges: [...existing.edges, ...incoming.edges],
              };
            },
          },
        },
      },
    },
  }),
});
