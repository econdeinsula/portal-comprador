export async function exportarComoPDF(elementoId, nomeFicheiro) {
  const html2canvas = (await import('html2canvas')).default
  const { jsPDF } = await import('jspdf')

  const elemento = document.getElementById(elementoId)
  if (!elemento) return

  const canvas = await html2canvas(elemento, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  })

  const imagem = canvas.toDataURL('image/png')
  const larguraPagina = 210 // A4 em mm
  const alturaPagina = 297
  const larguraImagem = larguraPagina - 20
  const alturaImagem = (canvas.height * larguraImagem) / canvas.width

  const pdf = new jsPDF('p', 'mm', 'a4')
  let alturaRestante = alturaImagem
  let posicaoY = 10

  pdf.addImage(imagem, 'PNG', 10, posicaoY, larguraImagem, alturaImagem)
  alturaRestante -= (alturaPagina - 20)

  while (alturaRestante > 0) {
    posicaoY = alturaRestante - alturaImagem + 10
    pdf.addPage()
    pdf.addImage(imagem, 'PNG', 10, posicaoY, larguraImagem, alturaImagem)
    alturaRestante -= alturaPagina
  }

  pdf.save(nomeFicheiro)
}