import { makeExecutableSchema } from 'graphql-tools';

import log from '../util/log';

const Schema = `
type Module {
  id: Int!
  code: String!
  title: String!
  department: String
  description: String
  credit: Float
  workload: String
  prerequisite: String
  corequisite: String
  examDate: String
  examOpenBook: Boolean
  examDuration: String
  examVenue: String
  timetable: [Lesson]
}

type Lesson {
  id: Int!
  classNo: String
  lessonType: String
  weekText: String
  dayText: String
  startTime: String
  endTime: String
  venue: String
}

# the schema allows the following query:
type Query {
  module(code: String): Module
}

schema {
  query: Query
}
`;

const Resolvers = {
  Query: {
    module(root, { code }) {
      return;
    },
  }
};

const subLog = log.child({ path: 'graphql' });
const logger = {
  log: e => subLog.error(e),
};

const schema = makeExecutableSchema({
  typeDefs: Schema,
  resolvers: Resolvers,
  logger,
});

export default schema;
