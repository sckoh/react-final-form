// @flow
import * as React from 'react'
import {
  createForm,
  formSubscriptionItems,
  version as ffVersion
} from 'final-form'
import type {
  FormApi,
  Config,
  FormSubscription,
  FormState,
  FormValuesShape,
  Unsubscribe
} from 'final-form'
import type { FormProps as Props } from './types'
import renderComponent from './renderComponent'
import useWhenValueChanges from './useWhenValueChanges'
import useConstant from './useConstant'
import shallowEqual from './shallowEqual'
import isSyntheticEvent from './isSyntheticEvent'
import type { FormRenderProps } from './types.js.flow'
import ReactFinalFormContext from './context'
import useLatest from './useLatest'
import { version } from '../package.json'

export { version }

const versions = {
  'final-form': ffVersion,
  'react-final-form': version
}

export const all: FormSubscription = formSubscriptionItems.reduce(
  (result, key) => {
    result[key] = true
    return result
  },
  {}
)

function ReactFinalForm<FormValues: FormValuesShape>({
  debug,
  decorators,
  destroyOnUnregister,
  form: alternateFormApi,
  initialValues,
  initialValuesEqual,
  keepDirtyOnReinitialize,
  mutators,
  onSubmit,
  subscription = all,
  validate,
  validateOnBlur,
  ...rest
}: Props<FormValues>) {
  const config: Config<FormValues> = {
    debug,
    destroyOnUnregister,
    initialValues,
    keepDirtyOnReinitialize,
    mutators,
    onSubmit,
    validate,
    validateOnBlur
  }

  const form: FormApi<FormValues> = useConstant(() => {
    const f = alternateFormApi || createForm<FormValues>(config)
    f.pauseValidation()
    return f
  })

  // synchronously register and unregister to query form state for our subscription on first render
  const [state, setState] = React.useState<FormState<FormValues>>(
    (): FormState<FormValues> => {
      let initialState: FormState<FormValues> = {}
      form.subscribe(state => {
        initialState = state
      }, subscription)()
      return initialState
    }
  )

  // save a copy of state that can break through the closure
  // on the shallowEqual() line below.
  const stateRef = useLatest<FormState<FormValues>>(state)

  React.useEffect(() => {
    // We have rendered, so all fields are no registered, so we can unpause validation
    form.isValidationPaused() && form.resumeValidation()
    const unsubscriptions: Unsubscribe[] = [
      form.subscribe(s => {
        if (!shallowEqual(s, stateRef.current)) {
          setState(s)
        }
      }, subscription),
      ...(decorators
        ? decorators.map(decorator =>
            // this noop ternary is to appease the flow gods
            // istanbul ignore next
            decorator(form)
          )
        : [])
    ]

    return () => {
      unsubscriptions.forEach(unsubscribe => unsubscribe())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decorators])

  // warn about decorator changes
  // istanbul ignore next
  if (process.env.NODE_ENV !== 'production') {
    // You're never supposed to use hooks inside a conditional, but in this
    // case we can be certain that you're not going to be changing your
    // NODE_ENV between renders, so this is safe.

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useWhenValueChanges(
      decorators,
      () => {
        console.error(
          'Form decorators should not change from one render to the next as new values will be ignored'
        )
      },
      shallowEqual
    )
  }

  // allow updatable config
  useWhenValueChanges(debug, () => {
    form.setConfig('debug', debug)
  })
  useWhenValueChanges(destroyOnUnregister, () => {
    form.destroyOnUnregister = !!destroyOnUnregister
  })
  useWhenValueChanges(
    initialValues,
    () => {
      form.setConfig('initialValues', initialValues)
    },
    initialValuesEqual || shallowEqual
  )
  useWhenValueChanges(keepDirtyOnReinitialize, () => {
    form.setConfig('keepDirtyOnReinitialize', keepDirtyOnReinitialize)
  })
  useWhenValueChanges(mutators, () => {
    form.setConfig('mutators', mutators)
  })
  useWhenValueChanges(onSubmit, () => {
    form.setConfig('onSubmit', onSubmit)
  })
  useWhenValueChanges(validate, () => {
    form.setConfig('validate', validate)
  })
  useWhenValueChanges(validateOnBlur, () => {
    form.setConfig('validateOnBlur', validateOnBlur)
  })

  const handleSubmit = (event: ?SyntheticEvent<HTMLFormElement>) => {
    if (event) {
      // sometimes not true, e.g. React Native
      if (typeof event.preventDefault === 'function') {
        event.preventDefault()
      }
      if (typeof event.stopPropagation === 'function') {
        // prevent any outer forms from receiving the event too
        event.stopPropagation()
      }
    }
    return form.submit()
  }

  const renderProps: FormRenderProps<FormValues> = {
    // assign to force Flow check
    ...state,
    form: {
      ...form,
      reset: eventOrValues => {
        if (isSyntheticEvent(eventOrValues)) {
          // it's a React SyntheticEvent, call reset with no arguments
          form.reset()
        } else {
          form.reset(eventOrValues)
        }
      }
    },
    handleSubmit
  }
  return React.createElement(
    ReactFinalFormContext.Provider,
    { value: form },
    renderComponent(
      {
        ...rest,
        ...renderProps,
        __versions: versions
      },
      'ReactFinalForm'
    )
  )
}

export default React.memo(ReactFinalForm)
