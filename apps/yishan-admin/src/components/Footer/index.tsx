import { DefaultFooter } from '@ant-design/pro-components'
import React from 'react'
import styles from './index.module.less'

const Footer: React.FC = () => {
  return (
    <DefaultFooter
      className={styles.footer}
      style={{
        background: 'none',
      }}
      copyright={`${new Date().getFullYear()} Powered by zerocmf`}
      links={[]}
    />
  )
}

export default Footer
