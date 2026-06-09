// Traduz erros técnicos do backend para mensagens amigáveis em português

const ACTIONS = {
  insert: 'salvar',
  update: 'atualizar',
  delete: 'excluir',
}

// Mensagens específicas por tabela + tipo de erro
const FK_MESSAGES = {
  Bases: {
    title: 'Base possui membros cadastrados',
    message:
      'Esta base não pode ser excluída porque ainda tem membros vinculados a ela.\n\n' +
      'Para excluí-la, primeiro remova ou transfira todos os membros desta base para outra.',
    contactAdmin: false,
  },
  Membros: {
    title: 'Membro possui registros vinculados',
    message:
      'Este membro não pode ser excluído porque há registros vinculados (notas, desafios etc.).\n\n' +
      'Entre em contato com o administrador para realizar esta operação.',
    contactAdmin: true,
  },
}

export function parseError(err, table = '', action = 'delete') {
  const msg = err?.message || ''
  const verb = ACTIONS[action] || action

  // Violação de chave estrangeira (ex.: excluir base com membros)
  if (/foreign key constraint/i.test(msg)) {
    return FK_MESSAGES[table] ?? {
      title: 'Registro vinculado a outros dados',
      message:
        'Este registro não pode ser excluído porque há outros dados vinculados a ele.\n\n' +
        'Remova os vínculos antes de tentar novamente, ou solicite ajuda ao administrador.',
      contactAdmin: false,
    }
  }

  // Violação de unicidade (duplicata)
  if (/unique constraint|duplicate key/i.test(msg)) {
    return {
      title: 'Registro duplicado',
      message:
        'Já existe um registro com essas informações. Verifique os dados preenchidos e tente novamente.',
      contactAdmin: false,
    }
  }

  // Coluna inexistente no banco (problema de configuração)
  if (/column .* does not exist|could not find the .* column/i.test(msg)) {
    return {
      title: 'Problema de configuração do sistema',
      message:
        'O sistema encontrou uma inconsistência na estrutura do banco de dados. ' +
        'Esta operação não pode ser concluída.',
      contactAdmin: true,
      technicalInfo: msg,
    }
  }

  // Permissão negada (RLS ou role)
  if (/permission denied|policy/i.test(msg)) {
    return {
      title: 'Acesso não permitido',
      message:
        'Você não tem permissão para realizar esta ação. ' +
        'Se precisar deste acesso, entre em contato com o administrador.',
      contactAdmin: true,
    }
  }

  // Problema de rede / conexão
  if (/network|timeout|failed to fetch/i.test(msg)) {
    return {
      title: 'Problema de conexão',
      message:
        'Não foi possível conectar ao servidor. ' +
        'Verifique sua conexão com a internet e tente novamente.',
      contactAdmin: false,
    }
  }

  // Erro genérico desconhecido
  return {
    title: `Erro ao ${verb}`,
    message:
      'Ocorreu um erro inesperado. Tente novamente. ' +
      'Se o problema persistir, entre em contato com o administrador do sistema.',
    contactAdmin: true,
    technicalInfo: msg,
  }
}
