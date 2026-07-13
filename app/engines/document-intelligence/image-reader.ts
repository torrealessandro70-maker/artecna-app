import Tesseract from 'tesseract.js'

const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Immagine non leggibile'))
    }

    reader.onerror = () => {
      reject(new Error('Errore lettura immagine'))
    }

    reader.readAsDataURL(file)
  })
}

export const readImageText = async (file: File): Promise<string> => {
  const image = await fileToDataUrl(file)
  const result = await Tesseract.recognize(image, 'ita')

  return result.data.text.trim()
}