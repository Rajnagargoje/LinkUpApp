import axiosClient from "./axiosClient"

export const createRoomApi = async (roomDetail:any) => {
    return await axiosClient.post('/v1/rooms', roomDetail);
}

export const joinChatApi = async (roomId:any) => {
    return await axiosClient.get(`/v1/rooms/${roomId}`);
}


export const getMessagesApi = async (roomId:any, size = 50, page = 0) => {
   return await axiosClient.get(`/v1/rooms/${roomId}/messages?size=${size}&page=${page}`)
}