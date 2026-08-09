export const site = {
  comunidade: "Comunidade Santa Luzia",
  grupo: "Acólitos e Coroinhas São Padre Pio",
  paroquia: "Paróquia Nossa Senhora das Graças",
  endereco: {
    rua: "R. Mario de Almeida, 949",
    numeroReferencia: "999",
    bairro: "Santa Luzia",
    cidade: "Várzea Grande",
    estado: "MT",
    cep: "78120-826",
  },
  missas: [{ dia: "Sábado", horario: "18h00", descricao: "Missa da Comunidade" }],
}

export const enderecoCompleto = `999, ${site.endereco.rua} - ${site.endereco.bairro}, ${site.endereco.cidade} - ${site.endereco.estado}, ${site.endereco.cep}`
