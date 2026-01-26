import { SwapError, SwapErrorCode } from '../../domain/entities/errors';

export type UserFacingErrorCategory =
  | 'user-action'
  | 'temporary'
  | 'blocked'
  | 'unknown';

export interface UserFacingErrorPayload {
  success: false;
  error: {
    code: SwapErrorCode;
    category: UserFacingErrorCategory;
    title: string;
    description: string;
    actions: {
      primary: {
        type: 'retry';
        label: string;
        disabledUntil?: string;
      };
      secondary?: {
        type: 'support' | 'docs';
        label: string;
        href?: string;
      };
    };
    traceId: string;
    canRetry: boolean;
    retryAfterSeconds?: number;
  };
}

interface ErrorMappingConfig {
  category: UserFacingErrorCategory;
  title: string;
  description: string;
  secondaryAction?: {
    type: 'support' | 'docs';
    label: string;
    href?: string;
  };
}

const DEFAULT_PRIMARY_ACTION = {
  type: 'retry' as const,
  label: 'Tentar novamente',
};

const ERROR_MAPPINGS: Partial<Record<SwapErrorCode, ErrorMappingConfig>> = {
  [SwapErrorCode.MISSING_REQUIRED_PARAMS]: {
    category: 'user-action',
    title: 'Informações incompletas',
    description:
      'Para continuar, preencha todos os campos obrigatórios da operação.',
  },
  [SwapErrorCode.INVALID_REQUEST]: {
    category: 'user-action',
    title: 'Algo não confere',
    description:
      'Revise os dados informados. Alguns valores parecem estar fora do formato esperado.',
  },
  [SwapErrorCode.INVALID_AMOUNT]: {
    category: 'user-action',
    title: 'Valor inválido',
    description:
      'O valor informado não pôde ser processado. Ajuste o montante e tente outra vez.',
  },
  [SwapErrorCode.AMOUNT_TOO_LOW]: {
    category: 'user-action',
    title: 'Amount too low',
    description:
      'The amount is too low to cover network fees. Please increase the swap amount.',
  },
  [SwapErrorCode.AMOUNT_TOO_HIGH]: {
    category: 'user-action',
    title: 'Amount too high',
    description:
      'The amount exceeds the maximum allowed for this route. Please reduce the swap amount or try a different token pair.',
  },
  [SwapErrorCode.INVALID_TOKEN_ADDRESS]: {
    category: 'user-action',
    title: 'Token desconhecido',
    description:
      'Não conseguimos reconhecer esse token. Confirme o endereço antes de prosseguir.',
  },
  [SwapErrorCode.INVALID_CHAIN]: {
    category: 'user-action',
    title: 'Rede incompatível',
    description:
      'Selecione uma rede suportada pela Panorama Block para continuar.',
  },
  [SwapErrorCode.UNSUPPORTED_CHAIN]: {
    category: 'user-action',
    title: 'Rede não suportada',
    description:
      'Ainda não temos suporte para essa rede. Escolha outra opção disponível.',
  },
  [SwapErrorCode.UNSUPPORTED_TOKEN]: {
    category: 'user-action',
    title: 'Token não suportado',
    description:
      'Esse ativo ainda não faz parte da nossa lista. Tente outro token ou fale com o suporte.',
  },
  [SwapErrorCode.INSUFFICIENT_LIQUIDITY]: {
    category: 'user-action',
    title: 'Liquidez insuficiente',
    description:
      'Neste momento não há liquidez suficiente para completar essa troca. Vale tentar com um valor menor.',
  },
  [SwapErrorCode.NO_ROUTE_FOUND]: {
    category: 'user-action',
    title: 'Rota indisponível',
    description:
      'Não encontramos um caminho seguro entre esses ativos. Tente outro par ou rede.',
  },
  [SwapErrorCode.PRICE_IMPACT_TOO_HIGH]: {
    category: 'user-action',
    title: 'Impacto de preço alto',
    description:
      'Essa operação impacta muito o preço do token. Ajuste o valor ou aguarde melhores condições.',
  },
  [SwapErrorCode.SLIPPAGE_TOO_HIGH]: {
    category: 'user-action',
    title: 'Slippage acima do limite',
    description:
      'A tolerância de slippage está acima do permitido. Revise as preferências e tente novamente.',
  },
  [SwapErrorCode.APPROVAL_REQUIRED]: {
    category: 'user-action',
    title: 'Aprovação necessária',
    description:
      'Você precisa autorizar o uso do token antes de concluir a troca. Faça a aprovação e tente novamente.',
  },
  [SwapErrorCode.INSUFFICIENT_BALANCE]: {
    category: 'user-action',
    title: 'Saldo insuficiente',
    description:
      'Seu saldo não cobre essa operação. Refaça o cálculo ou adicione fundos.',
  },
  [SwapErrorCode.INVALID_GAS_PARAMS]: {
    category: 'temporary',
    title: 'Parâmetros de gas inválidos',
    description:
      'O provedor retornou parâmetros de gas inconsistentes. Tente novamente ou escolha outra rota.',
  },
  [SwapErrorCode.RATE_LIMIT_EXCEEDED]: {
    category: 'temporary',
    title: 'Muitos pedidos em sequência',
    description:
      'Recebemos várias tentativas em pouco tempo. Espere alguns instantes antes de tentar de novo.',
  },
  [SwapErrorCode.QUOTA_EXCEEDED]: {
    category: 'temporary',
    title: 'Limite atingido',
    description:
      'Você atingiu o limite de uso por agora. Aguarde e tente novamente mais tarde.',
  },
  [SwapErrorCode.TIMEOUT]: {
    category: 'temporary',
    title: 'Demorou demais',
    description:
      'A operação demorou para responder. Tente novamente e, se continuar, chame o suporte.',
  },
  [SwapErrorCode.RPC_ERROR]: {
    category: 'temporary',
    title: 'Oscilação na rede',
    description:
      'A rede está instável no momento. Tentaremos novamente se você insistir.',
  },
  [SwapErrorCode.PROVIDER_ERROR]: {
    category: 'temporary',
    title: 'Instabilidade do provedor',
    description:
      'Nosso provedor de liquidez não respondeu como deveria. Normalmente isso se resolve em instantes.',
  },
  [SwapErrorCode.CACHE_ERROR]: {
    category: 'temporary',
    title: 'Oscilação no cache',
    description:
      'Atualizamos algumas informações e o pedido não foi completado. Tente mais uma vez.',
  },
  [SwapErrorCode.DATABASE_ERROR]: {
    category: 'temporary',
    title: 'Instabilidade temporária',
    description:
      'Estamos com oscilações internas. Tente novamente em alguns instantes.',
  },
  [SwapErrorCode.UNAUTHORIZED]: {
    category: 'blocked',
    title: 'Sessão expirada',
    description:
      'Faça login novamente para continuar com segurança.',
    secondaryAction: {
      type: 'support',
      label: 'Falar com o suporte',
    },
  },
  [SwapErrorCode.FORBIDDEN]: {
    category: 'blocked',
    title: 'Acesso restrito',
    description:
      'Esta ação não está disponível para o seu perfil. Se precisar, fale com o suporte.',
    secondaryAction: {
      type: 'support',
      label: 'Falar com o suporte',
    },
  },
  [SwapErrorCode.SERVICE_UNAVAILABLE]: {
    category: 'blocked',
    title: 'Serviço temporariamente indisponível',
    description:
      'Estamos passando por manutenção ou instabilidade. Tente novamente em breve.',
  },
  [SwapErrorCode.MAINTENANCE]: {
    category: 'blocked',
    title: 'Estamos em manutenção',
    description:
      'Voltaremos em instantes. Obrigado por aguardar.',
    secondaryAction: {
      type: 'support',
      label: 'Acompanhar status',
      href: 'https://status.panoramablock.com',
    },
  },
};

export interface UserFacingErrorResult {
  status: number;
  payload: UserFacingErrorPayload;
  log: {
    traceId: string;
    code: SwapErrorCode;
    category: UserFacingErrorCategory;
    status: number;
    retryable: boolean;
  };
  error: SwapError;
}

export class UserFacingErrorMapper {
  public map(error: unknown, traceId: string): UserFacingErrorResult {
    const swapError = this.normalizeError(error);
    const status = swapError.httpStatus || 500;

    const mapping = ERROR_MAPPINGS[swapError.code];
    const inferredCategory =
      mapping?.category ||
      (swapError.isRetryable() ? 'temporary' : 'unknown');

    const category =
      inferredCategory === 'unknown' && status >= 400 && status < 500
        ? 'user-action'
        : inferredCategory;

    const retryAfterSeconds = this.resolveRetryAfterSeconds(swapError);
    const disabledUntil =
      retryAfterSeconds !== undefined
        ? new Date(Date.now() + retryAfterSeconds * 1000).toISOString()
        : undefined;

    const payload: UserFacingErrorPayload = {
      success: false,
      error: {
        code: swapError.code,
        category,
        title:
          mapping?.title ||
          'Estamos enfrentando uma instabilidade pontual',
        description:
          mapping?.description ||
          'Algo inesperado aconteceu, mas já estamos acompanhando aqui. Tente novamente em alguns instantes.',
        actions: {
          primary: {
            ...DEFAULT_PRIMARY_ACTION,
            disabledUntil,
          },
          ...(mapping?.secondaryAction
            ? { secondary: mapping.secondaryAction }
            : {}),
        },
        traceId,
        canRetry: true,
        retryAfterSeconds,
      },
    };

    return {
      status,
      payload,
      log: {
        traceId,
        code: swapError.code,
        category,
        status,
        retryable: swapError.isRetryable(),
      },
      error: swapError,
    };
  }

  private normalizeError(error: unknown): SwapError {
    if (error instanceof SwapError) {
      return error;
    }

    if (error instanceof Error) {
      return new SwapError(
        SwapErrorCode.UNKNOWN_ERROR,
        error.message || 'Unknown error',
        {
          originalError: {
            message: error.message,
            stack: error.stack,
          },
        }
      );
    }

    return new SwapError(
      SwapErrorCode.UNKNOWN_ERROR,
      'Unexpected non-error thrown',
      {
        originalError: error,
      }
    );
  }

  private resolveRetryAfterSeconds(error: SwapError): number | undefined {
    const detail = error.details || {};

    if (typeof detail.retryAfter === 'number') {
      return detail.retryAfter;
    }

    if (typeof detail.retryAfterSeconds === 'number') {
      return detail.retryAfterSeconds;
    }

    return undefined;
  }
}
