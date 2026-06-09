import axios from 'axios'

const port = import.meta.env.VITE_PRINT_SERVICE_PORT ?? '5001'
const baseURL = `http://localhost:${port}`

export const printServiceApi = {
  reprintOrder: async (order_id: string): Promise<{ status: string }> => {
    const response = await axios.post(`${baseURL}/print/order/${order_id}`)
    return response.data
  },
}
