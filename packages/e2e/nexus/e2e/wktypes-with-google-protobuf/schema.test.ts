import { join } from "path";
import { readFile } from "fs/promises";

it("generates GraphQL schema SDL", async () => {
  expect(await readFile(join(__dirname, "__generated__", "schema.graphql"), "utf-8")).toMatchInlineSnapshot(`
    "### This file was generated by Nexus Schema
    ### Do not make changes to this file directly


    \\"\\"\\"
    A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the \`date-time\` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar.
    \\"\\"\\"
    scalar DateTime

    type Message {
      boolValue: Boolean
      boolValues: [Boolean!]
      doubleValue: Float
      doubleValues: [Float!]
      floatValue: Float
      floatValues: [Float!]
      int32Value: Int
      int32Values: [Int!]
      int64Value: String
      int64Values: [String!]

      \\"\\"\\"Required.\\"\\"\\"
      requiredTimestamp: DateTime!
      stringValue: String
      stringValues: [String!]
      timestamp: DateTime
      timestamps: [DateTime!]
      uint32Value: Int
      uint32Values: [Int!]
      uint64Value: String
      uint64Values: [String!]
    }

    input MessageInput {
      boolValue: Boolean
      boolValues: [Boolean!]
      doubleValue: Float
      doubleValues: [Float!]
      floatValue: Float
      floatValues: [Float!]
      int32Value: Int
      int32Values: [Int!]
      int64Value: String
      int64Values: [String!]

      \\"\\"\\"Required.\\"\\"\\"
      requiredTimestamp: DateTime!
      stringValue: String
      stringValues: [String!]
      timestamp: DateTime
      timestamps: [DateTime!]
      uint32Value: Int
      uint32Values: [Int!]
      uint64Value: String
      uint64Values: [String!]
    }

    type Query {
      test1: Message
    }
    "
  `);
});
