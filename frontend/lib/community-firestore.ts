import {
    collection,
    doc,
    type DocumentData,
    type FirestoreDataConverter,
    type QueryDocumentSnapshot,
    type SnapshotOptions,
} from 'firebase/firestore'

import { db } from '@/lib/firebase'
import type {
    CommunityCommentRecord,
    CommunityMarkerRecord,
    CommunityPostRecord,
    CommunityReportRecord,
} from '@/types'

const POSTS_COLLECTION = 'posts'
const USERS_COLLECTION = 'users'
const REPORTS_COLLECTION = 'reports'
const COMMENTS_COLLECTION = 'comments'
const LIKES_COLLECTION = 'likes'
const SAVES_COLLECTION = 'saves'

function createConverter<T extends DocumentData>(): FirestoreDataConverter<T> {
    return {
        toFirestore(value: T) {
            return value
        },
        fromFirestore(
            snapshot: QueryDocumentSnapshot<DocumentData>,
            options: SnapshotOptions
        ) {
            return snapshot.data(options) as T
        },
    }
}

const communityPostConverter = createConverter<CommunityPostRecord>()
const communityCommentConverter = createConverter<CommunityCommentRecord>()
const communityReportConverter = createConverter<CommunityReportRecord>()
const communityMarkerConverter = createConverter<CommunityMarkerRecord>()

export function postsCollection() {
    return collection(db, POSTS_COLLECTION).withConverter(communityPostConverter)
}

export function postDoc(postId: string) {
    return doc(db, POSTS_COLLECTION, postId).withConverter(communityPostConverter)
}

export function postReportsCollection(postId: string) {
    return collection(db, POSTS_COLLECTION, postId, REPORTS_COLLECTION).withConverter(
        communityReportConverter
    )
}

export function postCommentsCollection(postId: string) {
    return collection(db, POSTS_COLLECTION, postId, COMMENTS_COLLECTION).withConverter(
        communityCommentConverter
    )
}

export function postCommentDoc(postId: string, commentId: string) {
    return doc(db, POSTS_COLLECTION, postId, COMMENTS_COLLECTION, commentId).withConverter(
        communityCommentConverter
    )
}

export function postReportDoc(postId: string, uid: string) {
    return doc(db, POSTS_COLLECTION, postId, REPORTS_COLLECTION, uid).withConverter(
        communityReportConverter
    )
}

export function userDoc(uid: string) {
    return doc(db, USERS_COLLECTION, uid)
}

export function userLikesCollection(uid: string) {
    return collection(db, USERS_COLLECTION, uid, LIKES_COLLECTION).withConverter(
        communityMarkerConverter
    )
}

export function userLikeDoc(uid: string, postId: string) {
    return doc(db, USERS_COLLECTION, uid, LIKES_COLLECTION, postId).withConverter(
        communityMarkerConverter
    )
}

export function userSavesCollection(uid: string) {
    return collection(db, USERS_COLLECTION, uid, SAVES_COLLECTION).withConverter(
        communityMarkerConverter
    )
}

export function userSaveDoc(uid: string, postId: string) {
    return doc(db, USERS_COLLECTION, uid, SAVES_COLLECTION, postId).withConverter(
        communityMarkerConverter
    )
}
