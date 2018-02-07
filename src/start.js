import {
  MongoClient,
  ObjectId
} from 'mongodb'
import express from 'express'
import bodyParser from 'body-parser'
import {
  graphqlExpress,
  graphiqlExpress
} from 'graphql-server-express'
import {
  makeExecutableSchema
} from 'graphql-tools'
import cors from 'cors'

const URL = 'http://localhost'
const PORT = 3001
const MONGO_URL = 'mongodb://localhost:27017/blog'

const prepare = (o) => {
  o._id = o._id.toString()
  return o
}

export const start = async () => {
  try {

    MongoClient.connect(MONGO_URL, (err, database) => {
      const db = database.db('blog');
      const Posts = db.collection('posts');
      const Comments = db.collection('comments');
    });

    const typeDefs = [`
      type Query {
        post(_id: String): Post
        posts: [Post]
        comment(_id: String): Comment
      }

      type Post {
        _id: String
        title: String
        content: String
        comments: [Comment]
      }

      type Comment {
        _id: String
        postId: String
        content: String
        post: Post
      }

      type Mutation {
        createPost(title: String, content: String): Post
        createComment(postId: String, content: String): Comment
      }

      schema {
        query: Query
        mutation: Mutation
      }
    `];

    const resolvers = {
      Query: {
        post: async (root, {
          _id
        }) => {
          return prepare(await Posts.findOne(ObjectId(_id)))
        },
        posts: async () => {
          return (await Posts.find({}).toArray()).map(prepare)
        },
        comment: async (root, {
          _id
        }) => {
          return prepare(await Comments.findOne(ObjectId(_id)))
        },
      },
      Post: {
        comments: async ({
          _id
        }) => {
          return (await Comments.find({
            postId: _id
          }).toArray()).map(prepare)
        }
      },
      Comment: {
        post: async ({
          postId
        }) => {
          return prepare(await Posts.findOne(ObjectId(postId)))
        }
      },
      Mutation: {
        createPost: async (root, args, context, info) => {
          const res = await Posts.insert(args)
          return prepare(await Posts.findOne({
            _id: res.insertedIds[1]
          }))
        },
        createComment: async (root, args) => {
          const res = await Comments.insert(args)
          return prepare(await Comments.findOne({
            _id: res.insertedIds[1]
          }))
        },
      },
    }

    const schema = makeExecutableSchema({
      typeDefs,
      resolvers
    })

    const app = express()

    app.use(cors())

    app.use('/graphql', bodyParser.json(), graphqlExpress({
      schema
    }))

    const homePath = '/graphiql'

    app.use(homePath, graphiqlExpress({
      endpointURL: '/graphql'
    }))

    app.listen(PORT, () => {
      console.log(`Visit ${URL}:${PORT}${homePath}`)
    })

  } catch (e) {
    console.log(e)
  }

}