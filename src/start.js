import { MongoClient, ObjectId } from 'mongodb'
import Koa from 'koa'
import koaBody from 'koa-bodyparser'
import { ApolloServer, gql } from 'apollo-server-koa'
import { prepare } from '../util/index'

const app = new Koa()

const homePath = '/graphql'
const URL = 'http://localhost'
const PORT = 3001
const MONGO_URL = 'mongodb://localhost:27017/blog'

export const start = async () => {
  try {
    const database = await MongoClient.connect(MONGO_URL, {
      useUnifiedTopology: true,
    })

    const Posts = database.db().collection('posts')
    const Comments = database.db().collection('comments')

    const typeDefs = gql`
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
    `

    const resolvers = {
      Query: {
        post: async (root, { _id }) => {
          return prepare(await Posts.findOne(ObjectId(_id)))
        },
        posts: async () => {
          return (await Posts.find({}).toArray()).map(prepare)
        },
        comment: async (root, { _id }) => {
          return prepare(await Comments.findOne(ObjectId(_id)))
        },
      },
      Post: {
        comments: async ({ _id }) => {
          return (await Comments.find({ postId: _id }).toArray()).map(prepare)
        },
      },
      Comment: {
        post: async ({ postId }) => {
          return prepare(await Posts.findOne(ObjectId(postId)))
        },
      },
      Mutation: {
        createPost: async (root, args, context, info) => {
          const res = await Posts.insertOne(args)
          return prepare(res.ops[0]) // https://mongodb.github.io/node-mongodb-native/3.1/api/Collection.html#~insertOneWriteOpResult
        },
        createComment: async (root, args) => {
          const res = await Comments.insert(args)
          return prepare(await Comments.findOne({ _id: res.insertedIds[1] }))
        },
      },
    }

    app.use(koaBody())

    const server = new ApolloServer({ typeDefs, resolvers })
    server.applyMiddleware({ app })

    app.listen({ port: PORT }, () => {
      console.log(`Visit ${URL}:${PORT}${homePath}`)
    })
  } catch (e) {
    console.log(e)
  }
}
