
// Funções utilitárias para máscaras de input

export const maskPhone = (value: string): string => {
  if (!value) return '';
  
  // Remove tudo que não é dígito
  let r = value.replace(/\D/g, "");
  
  // Limita a 11 dígitos (DDD + 9 dígitos) para evitar estouro
  if (r.length > 11) {
    r = r.substring(0, 11);
  }
  
  // Máscara para Celulares (11 dígitos): (XX) XXXXX-XXXX
  if (r.length > 10) {
    return r.replace(/^(\d\d)(\d{5})(\d{4}).*/, "($1) $2-$3");
  } 
  // Máscara para Telefones Fixos ou durante a digitação (até 10 dígitos): (XX) XXXX-XXXX
  else if (r.length > 5) {
    return r.replace(/^(\d\d)(\d{4})(\d{0,4}).*/, "($1) $2-$3");
  } 
  // Máscara para DDD
  else if (r.length > 2) {
    return r.replace(/^(\d\d)(\d{0,5}).*/, "($1) $2");
  } 
  // Início da digitação
  else {
    return r.replace(/^(\d*)/, "($1");
  }
};

export const maskCpf = (value: string): string => {
  if (!value) return '';
  return value
    .replace(/\D/g, "")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})/, "$1-$2")
    .replace(/(-\d{2})\d+?$/, "$1");
};

export const maskCnpj = (value: string): string => {
  if (!value) return '';
  return value
    .replace(/\D/g, "")
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .slice(0, 18);
};

export const maskCpfCnpj = (value: string): string => {
    // Decide dinamicamente se aplica CPF ou CNPJ baseado no tamanho
    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue.length <= 11) {
        return maskCpf(value);
    }
    return maskCnpj(value);
}

export const maskDate = (value: string): string => {
  if (!value) return '';
  return value
    .replace(/\D/g, "")
    .replace(/(\d{2})(\d)/, "$1/$2")
    .replace(/(\d{2})(\d)/, "$1/$2")
    .replace(/(\d{4})\d+?$/, "$1");
};

// --- VALIDAÇÕES ---

export const validateCPF = (cpf: string): boolean => {
  const cleanCPF = cpf.replace(/[^\d]+/g, '');
  if (cleanCPF.length !== 11 || !!cleanCPF.match(/(\d)\1{10}/)) return false;

  const cpfArray = cleanCPF.split('').map(el => +el);
  const rest = (count: number) => (cpfArray.slice(0, count - 12).reduce((s, q, i) => s + q * (count - i), 0) * 10) % 11 % 10;

  return rest(10) === cpfArray[9] && rest(11) === cpfArray[10];
};

export const validateCNPJ = (cnpj: string): boolean => {
  const cleanCNPJ = cnpj.replace(/[^\d]+/g, '');
  if (cleanCNPJ.length !== 14) return false;

  // Elimina CNPJs invalidos conhecidos
  if (/^(\d)\1+$/.test(cleanCNPJ)) return false;

  let tamanho = cleanCNPJ.length - 2;
  let numeros = cleanCNPJ.substring(0, tamanho);
  const digitos = cleanCNPJ.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0))) return false;

  tamanho = tamanho + 1;
  numeros = cleanCNPJ.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1))) return false;

  return true;
};

export const validateCpfCnpj = (val: string): boolean => {
  if (!val) return true; // Vazio é considerado válido (opcional), validação de obrigatório é externa
  const clean = val.replace(/\D/g, '');
  if (clean.length <= 11) return validateCPF(val);
  return validateCNPJ(val);
};

export const validateBirthDate = (dateString: string): boolean => {
    if (!dateString) return false;
    
    const date = new Date(dateString);
    const today = new Date();
    // Zera a hora de hoje para comparar apenas a data
    today.setHours(0, 0, 0, 0);
    
    const minYear = 1900;

    // Verifica se é uma data válida
    if (isNaN(date.getTime())) return false;

    // Verifica se a data não é futura
    if (date > today) return false;

    // Verifica se o ano é razoável (maior que 1900)
    if (date.getFullYear() < minYear) return false;

    return true;
};
